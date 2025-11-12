// src/components/PdfViewer.tsx (修正後)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import { RootState } from '@/redux/store';
import { PdfHighlight, Comment as CommentType, PdfRectWithPage, EditorState } from '../redux/features/editor/editorTypes';
import { selectActiveHighlightId, selectActiveCommentId} from '../redux/features/editor/editorSelectors';
import { setActiveHighlightId, setActiveCommentId, setPdfTextContent, setActiveScrollTarget, addComment } from '../redux/features/editor/editorSlice';
import FabricShapeLayer from './FabricShapeLayer';
import { extractShapeData } from '../utils/pdfShapeExtractor';
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from 'uuid';
import { PageLoadData, PdfViewerProps } from '@/types/PdfViewer';

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
  containerStyle = {},
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageData, setPageData] = useState<{ [n:number]:PageLoadData }>({});
  const [pageScales, setPageScales] = useState<{ [n:number]:number }>({});
  const [pageShapeData, setPageShapeData] = useState<{ [n:number]:PdfRectWithPage[] }>({});

  const viewerRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const [selectionMenu, setSelectionMenu] = useState({
    x: 0, y: 0, visible: false, pendingHighlight: null as PdfHighlight|null
  });

  const activeHighlightId = useSelector(selectActiveHighlightId);
  const activeCommentId = useSelector(selectActiveCommentId);

  const activeHighlightFromComment = React.useMemo(() => {
    if (!activeCommentId) return null;
    const c = comments.find((x) => x.id === activeCommentId);
    return c ? c.highlightId : null;
  }, [activeCommentId, comments]);

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
    } catch (error) {
      console.error(`Error extracting text content for page ${n}:`, error);
      newPageData.textContent = '';
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
    if(!pageData[page]||!pageScales[page]) return null;
    const scale = pageScales[page];

    return highlights
      .filter(h => h.rects.some(r => r.pageNum===page))
      .flatMap(h => h.rects
        .filter(r => r.pageNum===page)
        .map((r,idx)=>{
          const isActive = effectiveActiveHighlightId === h.id;

          // --- ハイライトの描画要素 (pointer-events: none) ---
          const style={
            position:'absolute' as const,
            left:r.x1*scale,
            top:r.y1*scale,
            width:(r.x2-r.x1)*scale,
            height:(r.y2-r.y1)*scale,
            background: isActive ? 'rgba(255,200,0,0.65)' : 'rgba(255,235,59,0.35)',
            borderRadius:2,
            // pointer-events: none に設定し、全てのイベントを下層に透過させる
            pointerEvents: 'none' as const,
            // TextLayerより上に配置
            zIndex: isActive ? 20 : 8,
            boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.12)' : undefined,
          };

          return (
            <div
              key={`${h.id}-${idx}-visual`}
              data-highlight-id={h.id}
              className='highlight-visual'
              style={style}
            />
          );
        }));
  },[highlights,pageData,pageScales,effectiveActiveHighlightId]);


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

            // スクロールターゲット設定ロジック
            const rect = clickedHighlight.rects.find(r => r.pageNum === pageNum);
            if (viewerRef.current && rect) {
                const viewerRect = viewerRef.current.getBoundingClientRect();
                const scrollTarget = {
                    pdfY1: rect.y1,
                    pageNum: pageNum,
                    pageScale: pageScale,
                    pageTopOffset: pageRect.top - viewerRect.top,
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

  const handleCompletion = useCallback(async () => {
    console.log(pdfTextContent);
    let inst_highlight_comment = '';
    for (const h of highlights) {
      const related = comments.filter(c => c.highlightId === h.id);
      if (related.length > 0) {
        for (const c of related) {
          inst_highlight_comment += `id: ${c.id}, highlightId: ${h.id}, highlight: ${h.text}, comment: ${c.text}\n`;
        }
      } else {
        inst_highlight_comment += `highlightId: ${h.id}, highlight: ${h.text}, comment: (none)\n`;
      }
    }

    const instruction = `MT資料の内容に関して，学習者が吟味をしている箇所にはハイライトと吟味した内容を書かせています．ハイライトがある箇所に対して，吟味をさせる素材を与えるような示唆を出してください．出力は下記の形式をJSONを参考にして出力してください．以下に出力形式の参考例，MT資料，ハイライト箇所と対応するコメント内容を提供します．
      #出力の参考にするJSON形式
      {
        "responses": [
          {
            "highlighted": [
              {
                "id": "入力データのidと対応したid",
                "response": "レスポンス内容",
              }
            ]
            "non-highlighted": [
                "text": "示唆の対象テキスト",
                "response": "レスポンス内容",
            ]
          }
        ]
      }

      #MT資料
      ${pdfTextContent}

      #ハイライト箇所と対応するコメント内容
      ${inst_highlight_comment}`;

      try {
        const response = await axios.post('/api/analyze', {
            instruction: instruction
        });
        console.log(response.data);
        const data = response.data;
        if (data?.responses && Array.isArray(data.responses)) {
          // APIからの各応答を、ユーザコメントと同じ形でReduxに追加（author: 'AI'）
          // let lastAddedCommentId: string | null = null;
          // data.responses.forEach((r: { id: string; response: string }) => {
          //   const commentObj: CommentType = {
          //     id: uuidv4(),
          //     highlightId: r.id,
          //     parentId: null,
          //     author: 'AI',
          //     text: r.response,
          //     createdAt: new Date().toISOString(),
          //     editedAt: null,
          //     deleted: false,
          //   };
          //   dispatch(addComment(commentObj));
          //   lastAddedCommentId = commentObj.id;
          // });

          // 最後に追加したコメントをアクティブにする（UIに即表示されるように）
          // if (lastAddedCommentId) {
          //   dispatch(setActiveCommentId(lastAddedCommentId));
          // }
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('API Route Error:', error.response?.data || error.message);
        } else {
            console.error('An unexpected error occurred:', error);
        }
    }
  }, [highlights, comments, pdfTextContent, dispatch]);

  return (
    // 修正箇所: JavaScriptコメントからJSXコメントに変更
    // {/* 親のコンテナ (viewerRef) は引き続き幅100%で、overflowY: auto を持つ */}
    <div
        style={{
          position:"relative",
          width:"100%", // デフォルトで100%を維持
          height:"100%",
          overflowY: 'auto',
          ...containerStyle // 親から指定されたスタイル（特に width）を適用
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
              scale={1.5}
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