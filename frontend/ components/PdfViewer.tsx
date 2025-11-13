// src/components/PdfViewer.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import { RootState } from '@/redux/store';
import { PdfHighlight, Comment as CommentType, PdfRectWithPage, EditorState, HighlightCommentList } from '../redux/features/editor/editorTypes';
import { selectActiveHighlightId, selectActiveCommentId } from '../redux/features/editor/editorSelectors';
import { setActiveHighlightId, setActiveCommentId, setPdfTextContent, setActiveScrollTarget, addComment, addHighlightWithComment, updateHighlightMemo } from '../redux/features/editor/editorSlice';
import FabricShapeLayer from './FabricShapeLayer';
import { extractShapeData } from '../utils/pdfShapeExtractor';
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from 'uuid';
import { PageLoadData, PdfViewerProps } from '@/types/PdfViewer';
import { MIN_PDF_WIDTH, OPTION_SYSTEM_PROMPT, FORMAT_DATA_SYSTEM_PROMPT } from '@/utils/constants';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PdfViewer: React.FC<PdfViewerProps> = ({
  file,
  highlights,
  comments,
  onRequestAddHighlight,
  onHighlightClick,
  onRenderSuccess,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageData, setPageData] = useState<{ [n:number]:PageLoadData }>({});
  const [pageScales, setPageScales] = useState<{ [n:number]:number }>({});
  const [pageShapeData, setPageShapeData] = useState<{ [n:number]:PdfRectWithPage[] }>({});
  const [pageTextItems, setPageTextItems] = useState<{ [n:number]:any[] }>({});
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState<PdfHighlight | null>(null);

  const viewerRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const [selectionMenu, setSelectionMenu] = useState({
    x: 0, y: 0, visible: false, pendingHighlight: null as PdfHighlight|null
  });

  const pdfScale = useSelector((state: RootState) => state.editor.pdfScale);
  const activeHighlightId = useSelector(selectActiveHighlightId);
  const activeCommentId = useSelector(selectActiveCommentId);

  const activeHighlightFromComment = React.useMemo(() => {
    if (!activeCommentId) return null;
    const c = comments.find((x) => x.id === activeCommentId);
    return c ? c.highlightId : null;
  }, [activeCommentId, comments]);

  const mockResponseData = {
    "highlight_feedback": [
      // {
      //   "id": "1f53f84e-5b84-44cc-988a-5bbd71083f11",
      //   "highlight_id": "pdf-1762954464881",
      //   "intervention_needed": true,
      //   "reason": "UIの不便さについての懸念が表面的で具体的な解決策が示されていないため",
      //   "suggestion": "この懸念を解消するためには、どのような改善策が考えられるでしょうか？別のアプローチが必要かもしれません。"
      // },
      // ... 他のハイライトフィードバックデータ ...
      // {
      //   "id": "132928f9-7ef9-442a-8ebc-be690b87f4da",
      //   "highlight_id": "pdf-1762954555929",
      //   "intervention_needed": false,
      //   "reason": "UIの必要性について具体的な根拠が示されているため",
      //   "suggestion": ""
      // }
    ],
    "unhighlighted_feedback": [
      {
        "unhighlighted_text": "報告がメインになるため，特になし",
        "suggestion": "あああ"
      },
      // ... 他の未ハイライトフィードバックデータ ...
      {
        "unhighlighted_text": "今後予定している実装",
        "suggestion": "選択可能にすることの具体的な利点は何か、他に考えられる改善点はありますか？"
      },
      {
        "unhighlighted_text": "実装進捗の報告2025-11-04 松島丈翔",
        "suggestion": "あああ"
      },
      {
        "unhighlighted_text": "実装進捗報告議論したいこと・報告がメインになるため，特になし",
        "suggestion": "あああ"
      },
      {
        "unhighlighted_text": "pdf表示エリアにおいてハイライトをつける際に，入れ子構造や複数のハイライトに選択される場合の実装について",
        "suggestion": "あああ"
      }
    ]
  };

  const effectiveActiveHighlightId = activeHighlightId ?? activeHighlightFromComment ?? null;

  // PDF以外クリックで選択解除
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (
        viewerRef.current?.contains(target) ||
        target.closest('.pdf-add-menu') ||
        target.closest('.react-pdf__Page')
      ) {
        return;
      }

      dispatch(setActiveHighlightId(null));
      dispatch(setActiveCommentId(null));
      dispatch(setActiveScrollTarget(null));
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dispatch]);

  // selectionMenuの閉じ処理
  useEffect(() => {
    if (!selectionMenu.visible) return;

    const handleMenuClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.pdf-add-menu')) {
        return;
      }

      setSelectionMenu(s => ({ ...s, visible: false, pendingHighlight: null }));
    };
    document.addEventListener('mousedown', handleMenuClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleMenuClickOutside);
    };
  }, [selectionMenu.visible]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: PDFDocumentProxy) => {
    setNumPages(numPages);
    setPageData({});
    setPageScales({});
  }, []);

  const onPageLoadSuccess = useCallback(async (page:PDFPageProxy, n:number)=>{
    const viewport = page.getViewport({ scale:1 });
    const newPageData: PageLoadData = {
      width: viewport.width,
      height: viewport.height,
      viewport,
      textContent: null,
    };

    try {
      const textContentResult = await page.getTextContent();
      const text = textContentResult.items
          .map(item => ('str' in item) ? item.str : '')
          .join('');
      newPageData.textContent = text;
      
      // テキストアイテムの詳細情報を保存（座標情報付き）
      setPageTextItems(p => ({ ...p, [n]: textContentResult.items }));
    } catch (error) {
      console.error(`Error extracting text content for page ${n}:`, error);
      newPageData.textContent = '';
      setPageTextItems(p => ({ ...p, [n]: [] }));
    }

    try {
        const shapes = await extractShapeData(page);
        setPageShapeData(p => ({ ...p, [n]: shapes }));
    } catch (error) {
        console.error(`Error extracting shapes for page ${n}:`, error);
        setPageShapeData(p => ({ ...p, [n]: [] }));
    }

    setPageData(p=>({...p,[n]:newPageData}));
  },[]);

  // 全ページロード完了後に全テキストをReduxに保存するロジック
  useEffect(() => {
    if (!numPages || Object.keys(pageData).length === 0) return;

    if (Object.keys(pageData).length === numPages) {
      let fullText = '';
      for (let i = 1; i <= numPages; i++) {
        const data = pageData[i];
        if (data && data.textContent !== null) {
          fullText += (i > 1 ? '\n\n--- Page '+i+' ---\n\n' : '') + data.textContent;
        }
      }

      if (fullText) {
          dispatch(setPdfTextContent(fullText));
      }
    }
  }, [numPages, pageData, dispatch]);

  // PDFページのレンダリングが完了した後、その寸法からスケールを計算するロジック
  useEffect(()=>{
    if(!viewerRef.current || !numPages) return;
    setPageScales(prevScales => {
      let nScales:any = {};
      let changed = false;
      for(let i = 1; i <= numPages; i++){
        const dim = pageData[i];
        if(!dim) continue;
        // Pageコンポーネントが描画したCanvasの実際の幅を取得
        const el = viewerRef.current!.querySelector(`.react-pdf__Page[data-page-number="${i}"]`);
        const cv = el?.querySelector("canvas") as HTMLCanvasElement|null;
        const w = cv?.offsetWidth;
        if(w && dim.width){
          const s = w / dim.width;
          // 誤差を考慮して比較し、変更があれば更新
          // prevScales を参照することで、外部の pageScales に依存しない
          if(Math.abs((prevScales[i] || 0) - s) > 0.001){
              nScales[i] = s;
              changed = true;
          }
        }
      }
      // 変更がなければ前の状態をそのまま返し、setStateをスキップする
      if(!changed) {
          return prevScales;
      }
      // 変更があれば新しいスケールをマージして返す
      return {...prevScales, ...nScales};
  });
},[viewerRef, numPages, pageData]);

  // 全てのページスケールが確定したら、親にレンダリング完了を通知する
  useEffect(() => {
    const allScalesCalculated = numPages && Object.keys(pageScales).length === numPages;
    const allPageDataLoaded = numPages && Object.keys(pageData).length === numPages;

    if (allScalesCalculated && allPageDataLoaded && onRenderSuccess) {
      console.log("PDF Viewer: All pages rendered and scales calculated. Notifying parent.");
      onRenderSuccess();
    }
  }, [numPages, pageScales, pageData, onRenderSuccess]);


  // ハイライトの描画とクリックイベントを分離 (pointer-events: noneで透過)
  const renderHighlightVisuals = useCallback((page:number)=>{
    if(!pageData[page] || !pageScales[page]) return null;
    const scale = pageScales[page];
    const pageHighlights = highlights.filter(h => h.type === 'pdf' && (h as PdfHighlight).rects.some(r => r.pageNum === page));

    return pageHighlights.map((h) => {
      const pdfH = h as PdfHighlight;
      const pageRects = pdfH.rects.filter(r => r.pageNum === page);
      
      // AIによるハイライト（createdBy: 'AI'）は青色、その他は黄色
      const isAIHighlight = h.createdBy === 'AI';
      const baseBg = isAIHighlight ? 'rgba(52, 168, 224, 0.30)' : 'rgba(255, 235, 59, 0.40)';
      const activeBg = isAIHighlight ? 'rgba(52, 168, 224, 0.50)' : 'rgba(255, 235, 59, 0.65)';
      const baseBorderColor = isAIHighlight ? '#34a8e0' : '#ffeb3b';
      const activeBorderColor = isAIHighlight ? '#1e88c6' : '#fbc02d';

      const isActive = effectiveActiveHighlightId === h.id;

      return pageRects.map((rect, idx) => (
        <div
          key={`${h.id}-${idx}`}
          style={{
            position: 'absolute',
            left: `${rect.x1 * scale}px`,
            top: `${rect.y1 * scale}px`,
            width: `${(rect.x2 - rect.x1) * scale}px`,
            height: `${(rect.y2 - rect.y1) * scale}px`,
            backgroundColor: isActive ? activeBg : baseBg,
            border: `${isActive ? 3 : 2}px solid ${isActive ? activeBorderColor : baseBorderColor}`,
            borderRadius: '2px',
            cursor: 'pointer',
            pointerEvents: 'auto',
            boxSizing: 'border-box',
            boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.12)' : undefined,
            zIndex: isActive ? 50 : 10,
          }}
          onClick={(e) => {
            e.stopPropagation();
            // クリックで確実に active にする（外部 onHighlightClick も呼ぶ）
            dispatch(setActiveHighlightId(h.id));
            onHighlightClick?.(h.id);
          }}
        />
      ));
    });
  },[highlights,pageData,pageScales,effectiveActiveHighlightId, onHighlightClick, dispatch]);


  // TextNode対応 helper
  const getClosestPageElement = (node: Node): HTMLElement | null => {
    const el =
      node.nodeType === Node.TEXT_NODE
        ? (node.parentElement ?? null)
        : (node as HTMLElement);

    return el?.closest('.react-pdf__Page') ?? null;
  };

  // handleMouseUp (テキスト選択捕捉とハイライトクリック検出)
  const handleMouseUp = useCallback((e:React.MouseEvent)=>{
    const sel=window.getSelection();

    const target = e.target as HTMLElement;
    const clickedPageEl = target.closest('.react-pdf__Page');

    // --- ハイライトクリック検出ロジック ---
    // テキスト選択が行われなかった場合（単純クリックの場合）
    if(!sel || sel.isCollapsed) {
        if (!clickedPageEl) return;

        const pageNum = Number(clickedPageEl.getAttribute('data-page-number'));
        const pageScale = pageScales[pageNum] || 1;
        const pageRect = clickedPageEl.getBoundingClientRect();

        // クリック座標 (PDF座標)
        const clickX = (e.clientX - pageRect.left) / pageScale;
        const clickY = (e.clientY - pageRect.top) / pageScale;

        // クリックされた座標が既存のハイライトの矩形内にあるかチェック
        const clickedHighlight = highlights.find(h =>
            h.rects.some(r =>
                r.pageNum === pageNum &&
                r.x1 <= clickX && clickX <= r.x2 &&
                r.y1 <= clickY && clickY <= r.y2
            )
        );

        if (clickedHighlight) {
            // ハイライトがクリックされた場合の処理を実行
            e.stopPropagation(); // イベント伝播を停止
            onHighlightClick?.(clickedHighlight.id);
            dispatch(setActiveHighlightId(clickedHighlight.id));

            // スクロールターゲット設定ロジック（画面上の絶対Yを渡す）
            const rect = clickedHighlight.rects.find(r => r.pageNum === pageNum);
            if (viewerRef.current && rect) {
                const pageRect = clickedPageEl.getBoundingClientRect();
                // ハイライト矩形の上辺の画面上Y（絶対座標）
                const viewerY = pageRect.top + (rect.y1 * pageScale);
                // highlightId を含めて送る
                const scrollTarget = {
                    viewerY,
                    highlightId: clickedHighlight.id,
                    pageNum,
                };
                dispatch(setActiveScrollTarget(scrollTarget));
            }
            return; // ハイライト処理が完了したら終了
        }
    }
    // ----------------------------------------------------


    // --- 既存のテキスト選択ロジック (ハイライトクリックでなかった場合のみ実行) ---
    const text=sel.toString().trim();
    if(!text) return;

    const range=sel.getRangeAt(0);
    const rects=Array.from(range.getClientRects()).filter(r=>r.width>0&&r.height>0);
    if(rects.length===0) return;

    // テキスト選択の親要素がどのページか特定
    const firstRect=rects[0];
    const parent = getClosestPageElement(range.startContainer);
    if(!parent){ sel.removeAllRanges(); return;}

    const pageNum = Number(parent.getAttribute('data-page-number'));
    const pRect = parent.getBoundingClientRect();
    const scale = pageScales[pageNum]||1;

    // 選択範囲の矩形をPDF座標に変換
    const allRects: PdfRectWithPage[] = rects.map(r=>({
      pageNum,
      x1:(r.left-pRect.left)/scale,
      y1:(r.top-pRect.top)/scale,
      x2:(r.right-pRect.left)/scale,
      y2:(r.bottom-pRect.top)/scale,
    }));

    // メニュー表示
    setSelectionMenu({
      x: Math.min(window.innerWidth-80, firstRect.right+8),
      y: firstRect.top-10,
      visible: true,
      pendingHighlight:{
        id:`pdf-${Date.now()}`, type:"pdf", text, rects:allRects, memo:"", createdAt: `${Date.now()}`, createdBy: 'User'
      }
    });

    sel.removeAllRanges();
  },[pageScales, highlights, dispatch, onHighlightClick, viewerRef]);

  const addHighlight = ()=>{
    if(selectionMenu.pendingHighlight){
      onRequestAddHighlight?.(selectionMenu.pendingHighlight);
      setSelectionMenu(s=>({...s,visible:false,pendingHighlight:null}));
    }
  };

  const handleRequestShapeHighlight = useCallback((rects: PdfRectWithPage[]) => {
    const firstRect = rects[0];

    setSelectionMenu({
      x: window.innerWidth/2,
      y: window.innerHeight/2,
      visible: true,
      pendingHighlight:{
        id:`pdf-shape-${Date.now()}`,
        type:"pdf",
        text: `図形/画像ハイライト (P${firstRect.pageNum})`,
        rects: rects,
        memo:"",
        createdAt: `${Date.now()}`,
        createdBy: `${t("CommentPanel.comment-author-user")}`
      }
    });
  }, [t]);

  const pdfTextContent = useSelector((state: RootState) => state.editor.pdfTextContent);

  // テキストをPDF内で検索し、マッチ箇所の正確な矩形座標を返す
  const findTextInPdf = useCallback((searchText: string): PdfRectWithPage[] => {
    if (!pdfTextContent || !searchText.trim()) return [];

    const rects: PdfRectWithPage[] = [];
    const normalizedSearch = searchText.trim().toLowerCase();
    const normalizedContent = pdfTextContent.toLowerCase();

    // テキストを検索
    let startIndex = normalizedContent.indexOf(normalizedSearch);
    if (startIndex === -1) return [];

    // 全マッチを対象にするため、ループで複数マッチを処理
    const allMatches: number[] = [];
    let searchFromIndex = 0;
    while (true) {
      const matchIndex = normalizedContent.indexOf(normalizedSearch, searchFromIndex);
      if (matchIndex === -1) break;
      allMatches.push(matchIndex);
      searchFromIndex = matchIndex + 1;
    }

    // 最初のマッチのみを処理（複数マッチが必要な場合は、ここでループを追加可能）
    startIndex = allMatches[0];

    // マッチしたテキスト位置からページと座標を推定
    let currentPos = 0;
    for (let pageNum = 1; pageNum <= (numPages || 0); pageNum++) {
      const pageText = pageData[pageNum]?.textContent || '';
      const pageLength = pageText.length;
      const textItems = pageTextItems[pageNum] || [];

      if (currentPos + pageLength > startIndex && currentPos <= startIndex) {
        // このページにマッチテキストが開始する
        const relativeStart = startIndex - currentPos;
        const relativeEnd = relativeStart + searchText.length;

        // テキストアイテムから座標情報を取得
        if (textItems.length > 0) {
          let charIndex = 0;
          const matchRects: { x1: number; y1: number; x2: number; y2: number; y: number }[] = [];

          for (const item of textItems) {
            if (!('str' in item)) continue;

            const itemStr = item.str;
            const itemLength = itemStr.length;
            const itemEnd = charIndex + itemLength;

            // マッチ範囲とアイテムが重なっているかチェック
            if (itemEnd > relativeStart && charIndex < relativeEnd) {
              // アイテムの座標を取得（PDFテキストアイテムの座標システムは左下原点）
              const pageHeight = pageData[pageNum]?.height || 0;
              const x = item.transform[4] || 0; // x座標
              const y = pageHeight - (item.transform[5] || 0); // y座標を反転
              const width = item.width || 0;
              const height = item.height || 0;

              // マッチ範囲内の文字のみをハイライト対象にする
              const charStartInItem = Math.max(0, relativeStart - charIndex);
              const charEndInItem = Math.min(itemLength, relativeEnd - charIndex);
              const charWidthPerChar = itemLength > 0 ? width / itemLength : 0;

              const itemX1 = x + (charStartInItem * charWidthPerChar);
              const itemX2 = x + (charEndInItem * charWidthPerChar);

              matchRects.push({
                x1: itemX1,
                y1: y - height,
                x2: itemX2,
                y2: y,
                y: y, // 行の判定用にy座標を保持
              });
            }

            charIndex += itemLength;
          }

          // マッチしたアイテムがある場合、行ごとにグループ化して矩形を作成
          if (matchRects.length > 0) {
            // 同じ行（y座標が近い）のアイテムをグループ化
            const lines: typeof matchRects[] = [];
            const yThreshold = 3; // y座標の差がこの値以下なら同じ行と判定

            matchRects.forEach((rect) => {
              const existingLine = lines.find(
                (line) => Math.abs(line[0].y - rect.y) < yThreshold
              );

              if (existingLine) {
                existingLine.push(rect);
              } else {
                lines.push([rect]);
              }
            });

            // 各行ごとに矩形を作成
            lines.forEach((line) => {
              const minX1 = Math.min(...line.map((r) => r.x1));
              const maxX2 = Math.max(...line.map((r) => r.x2));
              const minY1 = Math.min(...line.map((r) => r.y1));
              const maxY2 = Math.max(...line.map((r) => r.y2));

              rects.push({
                pageNum,
                x1: minX1,
                y1: minY1,
                x2: maxX2,
                y2: maxY2,
              });
            });

            // マッチ終了がこのページ内で完結しているかチェック
            if (relativeEnd <= pageLength) {
              return rects; // このページで完結
            } else {
              // 次ページに続くため、処理を続ける
              currentPos += pageLength + 20;
              startIndex = currentPos; // 次ページの開始位置を更新
              continue;
            }
          }

          // テキストアイテムの座標情報がない場合は、簡易座標を使用
          const pageHeight = pageData[pageNum]?.height || 0;
          const pageWidth = pageData[pageNum]?.width || 0;

          if (pageHeight && pageWidth) {
            const estimatedX1 = 50;
            const estimatedY1 = (relativeStart / pageLength) * pageHeight;
            const estimatedX2 = pageWidth - 50;
            const estimatedY2 = estimatedY1 + 20;

            rects.push({
              pageNum,
              x1: Math.max(0, estimatedX1),
              y1: Math.max(0, estimatedY1),
              x2: Math.min(pageWidth, estimatedX2),
              y2: Math.min(pageHeight, estimatedY2),
            });
          }
          return rects;
        }
      }

      currentPos += pageLength + 20;
    }

    return rects;
  }, [pdfTextContent, pageData, pageTextItems, numPages]);

  const handleCompletion = useCallback(async () => {
    const highlightCommentList: HighlightCommentList = [];
    for (const h of highlights) {
      const related = comments.filter(c => c.highlightId === h.id);

      if (related.length > 0) {
        for (const c of related) {
          highlightCommentList.push({
            id: c.id,
            highlightId: h.id,
            highlight: h.text.trim(),
            comment: c.text.trim(),
          });
        }
      } else {
        highlightCommentList.push({
          id: "",
          highlightId: h.id,
          highlight: h.text.trim(),
          comment: "(none)",
        });
      }
    }

    try {
      // const firstResponse = await axios.post('/api/formatData', {
      //   formatDataPrompt: FORMAT_DATA_SYSTEM_PROMPT,
      //   pdfTextData: pdfTextContent
      // });
      // console.log(firstResponse.data);

      // const systemPrompt = OPTION_SYSTEM_PROMPT;
      // const userInput = {
      //   "mt_text": firstResponse.data.analysis,
      //   "highlights": highlightCommentList,
      // }

      // const response = await axios.post('/api/analyze', {
      //     systemPrompt: systemPrompt,
      //     userInput: userInput,
      // });

      // const responseData = JSON.parse(response.data.analysis);
      // console.log(responseData);

      const responseData = mockResponseData;
      if (responseData) {
        const highlight_feedback = responseData.highlight_feedback;
        const unhighlighted_feedback = responseData.unhighlighted_feedback;

        // ハイライト有箇所に対して，APIからの各応答をユーザコメントと同じ形でReduxに追加（author: 'AI'）
        highlight_feedback.forEach((hf: any) => {
          if (hf.intervention_needed && hf.suggestion) {
            dispatch(
              addComment({
                id: `s-${Date.now()}`,
                highlightId: hf.highlight_id,
                parentId: hf.id,
                author: 'AI',
                text: hf.suggestion,
                createdAt: new Date().toISOString(),
                editedAt: null,
                deleted: false,
            }));
          }
        });

        // ハイライト無箇所に対して，ハイライトをつけてコメントを追加
        unhighlighted_feedback.forEach((uhf: any, index: number) => {
          if (uhf.unhighlighted_text && uhf.suggestion) {
            // PDFテキストからテキストを検索し、ハイライト矩形を取得
            const foundRects = findTextInPdf(uhf.unhighlighted_text);

            if (foundRects.length > 0) {
              // ハイライトIDを生成
              const highlightId = `pdf-ai-${Date.now()}-${index}`;

              // ハイライトオブジェクトを作成（青色マーク用に createdBy: 'AI' を設定）
              const aiHighlight: PdfHighlight = {
                id: highlightId,
                type: "pdf",
                text: uhf.unhighlighted_text,
                rects: foundRects,
                memo: "",
                createdAt: new Date().toISOString(),
                createdBy: 'AI',
              };

              // ハイライトとコメントを一緒に追加
              const rootComment: CommentType = {
                id: uuidv4(),
                highlightId: highlightId,
                parentId: null,
                author: 'AI',
                text: uhf.suggestion,
                createdAt: new Date().toISOString(),
                editedAt: null,
                deleted: false,
              };

              dispatch(addHighlightWithComment({ highlight: aiHighlight, initialComment: rootComment }));
            }
          }
        });
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
          console.error('API Route Error:', error.response?.data || error.message);
      } else {
          console.error('An unexpected error occurred:', error);
      }
    }
  }, [highlights, comments, pdfTextContent, dispatch, findTextInPdf]);

  return (
    <div
        style={{
          position:"relative",
          width:"100%",
        }}
        ref={viewerRef}
        onMouseUp={handleMouseUp}
      >
      {file?(
        <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
          {Array.from(new Array(numPages || 0), (_, i) =>
          <div
            key={i + 1}
            style={{
              position: "relative",
              marginBottom: 12,
              margin: '0 auto',
              width: 'max-content',
            }}
          >
            <Page
              pageNumber={i + 1}
              onLoadSuccess={(p: PDFPageProxy) => onPageLoadSuccess(p, i + 1)}
              // アノテーションは必要ないので無効化
              renderAnnotationLayer={false}
              renderTextLayer={true}
              scale={pdfScale}
            />

            {/* ハイライトの描画レイヤー (pointer-events: noneで透過) */}
            {renderHighlightVisuals(i + 1)}

            {pageData[i + 1] && pageShapeData[i + 1] && (pageScales[i + 1] > 0) && (
              <FabricShapeLayer
                pageNumber={i + 1}
                width={pageData[i + 1].width}
                height={pageData[i + 1].height}
                viewport={pageData[i + 1].viewport}
                scale={pageScales[i + 1]}
                shapeData={pageShapeData[i + 1]}
                onSelectShape={handleRequestShapeHighlight}
              />
            )}
          </div>
        )}
        </Document>
      ): <p style={{textAlign:'center'}}>PDFを読み込んでいません</p> }

      {selectionMenu.visible && (
        <div className="pdf-add-menu"
          style={{
            position:"fixed",
            left:selectionMenu.x,
            top:selectionMenu.y,
            background:"#fff",
            border:"1px solid #ccc",
            borderRadius:4,
            padding:"4px 6px",
            display:"flex",
            gap:4,
            fontSize:12,
            zIndex:9999
          }}>
          <button style={{fontSize:12,padding:"2px 6px"}} onClick={addHighlight}>{t("PdfViewer.add-comment")}</button>
        </div>
      )}
      <div style={{textAlign:'center', padding: '20px 0'}}>
          <button
              onClick={handleCompletion}
              style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
              }}
          >
              {t("PdfViewer.complete")}
          </button>
      </div>
    </div>
  );
};

export default PdfViewer;