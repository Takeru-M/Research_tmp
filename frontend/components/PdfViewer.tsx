import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Document, Page, pdfjs } from 'react-pdf';
import { useDispatch, useSelector } from 'react-redux';
import { useSession } from 'next-auth/react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { RootState } from '@/redux/store';
import { PdfHighlight, Comment as CommentType, PdfRectWithPage } from '../redux/features/editor/editorTypes';
import { OptionAnalyzeRequest, DeliberationAnalyzeRequest, HighlightCommentThread, HighlightComment } from '@/types/Requests/OpenaiAnalyze';
import { selectActiveHighlightId, selectActiveCommentId, selectCompletionStage } from '../redux/features/editor/editorSelectors';
import { setActiveHighlightId, setActiveCommentId, setPdfTextContent, setActiveScrollTarget, addComment, addHighlightWithComment, setCompletionStage, clearSelectedRootComments } from '../redux/features/editor/editorSlice';
import { startLoading, stopLoading } from '../redux/features/loading/loadingSlice';
import FabricShapeLayer from './FabricShapeLayer';
import LoadingOverlay from './LoadingOverlay';
import { extractShapeData } from '../utils/pdfShapeExtractor';
import { useTranslation } from "react-i18next";
import { PageLoadData, PdfViewerProps } from '@/types/PdfViewer';
import { STAGE, HIGHLIGHT_COLOR, COMMENT_PURPOSE } from '@/utils/constants';
import { apiClient, parseJSONResponse } from '@/utils/apiClient';
import { ErrorDisplay } from './ErrorDisplay';
import { logUserAction } from '@/utils/logger';
import styles from '../styles/PdfViewer.module.css';
import {
  FormatDataResponse,
  OptionAnalyzeResponse,
  DeliberationAnalyzeResponse,
  DialogueResponse,
  HighlightCreateResponse,
  UpdateCompletionStageResponse,
} from '@/types/Responses/Openai';
import { CommentResponse } from '@/types/Responses/Comment';
import { DocumentFormattedTextRead } from '@/types/Responses/DocumentFormattedText';
import { groupTextItemsToLines, GroupedLine } from '../utils/pdfTextGrouper';

type SelectionMenuState = {
  x: number;
  y: number;
  visible: boolean;
  pendingHighlight: PdfHighlight | null;
};

type HighlightColors = {
  baseBg: string;
  activeBg: string;
  baseBorderColor: string;
  activeBorderColor: string;
};

pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PdfViewer: React.FC<PdfViewerProps> = ({
  file,
  highlights,
  comments,
  documentId,
  onRequestAddHighlight,
  onHighlightClick,
  onRenderSuccess,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageData, setPageData] = useState<{ [n:number]:PageLoadData }>({});
  const [pageScales, setPageScales] = useState<{ [n:number]:number }>({});
  const [pageShapeData, setPageShapeData] = useState<{ [n:number]:PdfRectWithPage[] }>({});
  const [pageTextItems, setPageTextItems] = useState<{ [n:number]:TextItem[] }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groupedTextLines, setGroupedTextLines] = useState<GroupedLine[]>([]);

  const viewerRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();

  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState>({
    x: 0,
    y: 0,
    visible: false,
    pendingHighlight: null,
  });

  const pdfScale = useSelector((state: RootState) => state.editor.pdfScale);
  const activeHighlightId = useSelector(selectActiveHighlightId);
  const activeCommentId = useSelector(selectActiveCommentId);
  const completionStage = useSelector(selectCompletionStage);
  const isLoading = useSelector((state: RootState) => state.loading.isLoading);
  const fileId = useSelector((state: RootState) => state.editor.fileId);
  const selectedRootCommentIds = useSelector((state: RootState) => state.editor.selectedRootCommentIds);

  const activeHighlightFromComment = React.useMemo(() => {
    if (!activeCommentId) return null;
    const c = comments.find((x) => x.id === activeCommentId);
    return c ? c.highlightId : null;
  }, [activeCommentId, comments]);

  const effectiveActiveHighlightId = activeHighlightId ?? activeHighlightFromComment ?? null;

  const buildHighlightThreads = useCallback((): HighlightCommentThread[] => {
    const highlightCommentThreads: HighlightCommentThread[] = [];

    for (const h of highlights) {
      const relatedComments = comments.filter((c) => c.highlightId === h.id);
      if (relatedComments.length === 0) continue;

      highlightCommentThreads.push({
        id: h.id,
        highlightId: h.id,
        highlight: h.text.trim(),
        comments: relatedComments.map((c) => ({
          id: c.id,
          parentId: c.parentId,
          author: c.author,
          text: c.text.trim(),
        })),
      });
    }

    return highlightCommentThreads;
  }, [comments, highlights]);

  const resolveHighlightColors = useCallback(
    (
      latestComment: CommentType | undefined,
      hasLLMComment: boolean,
      llmAuthor: string,
    ): HighlightColors => {
      if (!latestComment) {
        return {
          baseBg: HIGHLIGHT_COLOR.USER_HIGHLIGHT_BASE,
          activeBg: HIGHLIGHT_COLOR.USER_HIGHLIGHT_ACTIVE,
          baseBorderColor: HIGHLIGHT_COLOR.USER_HIGHLIGHT_BASE_BORDER,
          activeBorderColor: HIGHLIGHT_COLOR.USER_HIGHLIGHT_ACTIVE_BORDER,
        };
      }

      if (latestComment.author === llmAuthor) {
        return {
          baseBg: HIGHLIGHT_COLOR.LLM_HIGHLIGHT_BASE,
          activeBg: HIGHLIGHT_COLOR.LLM_HIGHLIGHT_ACTIVE,
          baseBorderColor: HIGHLIGHT_COLOR.LLM_HIGHLIGHT_BASE_BORDER,
          activeBorderColor: HIGHLIGHT_COLOR.LLM_HIGHLIGHT_ACTIVE_BORDER,
        };
      }

      if (hasLLMComment) {
        return {
          baseBg: HIGHLIGHT_COLOR.ANSWER_HIGHLIGHT_BASE,
          activeBg: HIGHLIGHT_COLOR.ANSWER_HIGHLIGHT_ACTIVE,
          baseBorderColor: HIGHLIGHT_COLOR.ANSWER_HIGHLIGHT_BASE_BORDER,
          activeBorderColor: HIGHLIGHT_COLOR.ANSWER_HIGHLIGHT_ACTIVE_BORDER,
        };
      }

      return {
        baseBg: HIGHLIGHT_COLOR.USER_HIGHLIGHT_BASE,
        activeBg: HIGHLIGHT_COLOR.USER_HIGHLIGHT_ACTIVE,
        baseBorderColor: HIGHLIGHT_COLOR.USER_HIGHLIGHT_BASE_BORDER,
        activeBorderColor: HIGHLIGHT_COLOR.USER_HIGHLIGHT_ACTIVE_BORDER,
      };
    },
    [],
  );

  // ユーザーIDを取得するヘルパー関数をメモ化
  const getUserId = useCallback(() => session?.user?.id || session?.user?.email || 'anonymous', [session]);

  // JWT に保持しているドキュメントIDを取得
  const getDocumentId = useCallback((): number | null => {
    const docId = (session as any)?.preferredDocumentId ?? (session as any)?.user?.preferredDocumentId ?? null;
    if (docId === null || docId === undefined) return null;
    const n = Number(docId);
    return Number.isNaN(n) ? null : n;
  }, [session]);

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
      logUserAction('pdf_selection_menu_closed', {
        reason: 'outside_click',
        timestamp: new Date().toISOString(),
      }, getUserId());
    };
    document.addEventListener('mousedown', handleMenuClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleMenuClickOutside);
    };
  }, [selectionMenu.visible, getUserId]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: PDFDocumentProxy) => {
    setNumPages(numPages);
    setPageData({});
    setPageScales({});
    logUserAction('pdf_document_loaded', {
      totalPages: numPages,
      timestamp: new Date().toISOString(),
    }, getUserId());
  }, [getUserId]);

  useEffect(() => {
    setNumPages(null);
    setPageData({});
    setPageScales({});
  }, [file]);

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

      setPageTextItems(p => ({ ...p, [n]: textContentResult.items as TextItem[] }));
    } catch (error) {
      console.error(`Error extracting text content for page ${n}:`, error);
      newPageData.textContent = '';
      setPageTextItems(p => ({ ...p, [n]: [] }));
      logUserAction('pdf_text_extraction_failed', {
        pageNumber: n,
        reason: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString(),
      }, getUserId());
    }

    try {
        const shapes = await extractShapeData(page);
        setPageShapeData(p => ({ ...p, [n]: shapes }));
    } catch (error) {
        console.error(`Error extracting shapes for page ${n}:`, error);
        setPageShapeData(p => ({ ...p, [n]: [] }));
        logUserAction('pdf_shape_extraction_failed', {
          pageNumber: n,
          reason: error instanceof Error ? error.message : 'unknown',
          timestamp: new Date().toISOString(),
        }, getUserId());
    }

    setPageData(p=>({...p,[n]:newPageData}));
  },[getUserId]);

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
          logUserAction('pdf_text_content_extracted', {
            totalPages: numPages,
            textLength: fullText.length,
            timestamp: new Date().toISOString(),
          }, getUserId());
      }
    }
  }, [numPages, pageData, dispatch, getUserId]);

  // 全ページロード後に行グルーピングを生成
  useEffect(() => {
    if (!numPages) return;
    // 必要なデータが揃っているか確認
    for (let i = 1; i <= numPages; i++) {
      if (!pageTextItems[i] || !pageData[i]?.height) return;
    }

    const lines: GroupedLine[] = [];
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageHeight = pageData[pageNum]?.height || 0;
      const grouped = groupTextItemsToLines(pageTextItems[pageNum] || [], pageHeight);
      grouped.forEach((g) => (g.pageNum = pageNum));
      lines.push(...grouped);
    }

    // ページ順にソート
    lines.sort((a, b) => a.pageNum - b.pageNum || a.yCenter - b.yCenter);
    setGroupedTextLines(lines);
  }, [numPages, pageTextItems, pageData]);

  // PDFページのレンダリングが完了した後、その寸法からスケールを計算するロジック
  useEffect(()=>{
    if(!viewerRef.current || !numPages) return;
    setPageScales(prevScales => {
      const nScales: { [n: number]: number } = {};
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
      logUserAction('pdf_rendering_complete', {
        totalPages: numPages,
        timestamp: new Date().toISOString(),
      }, getUserId());
      onRenderSuccess();
    }
  }, [numPages, pageScales, pageData, onRenderSuccess, getUserId]);

  // LLM名をuseMemoでメモ化し、コメント取得時も再評価されるようにする
  const llmAuthorName = React.useMemo(() => t("CommentPanel.comment-author-LLM"), [t, comments]);

  // ハイライトの描画とクリックイベントを分離 (pointer-events: noneで透過)
  const renderHighlightVisuals = useCallback((page:number)=>{
    if(!pageData[page] || !pageScales[page]) return null;
    const scale = pageScales[page];
    const pageHighlights = highlights.filter(h => h.type === 'pdf' && (h as PdfHighlight).rects.some(r => r.pageNum === page));

    return pageHighlights.map((h) => {
      const pdfH = h as PdfHighlight;
      const pageRects = pdfH.rects.filter(r => r.pageNum === page);

      // ハイライトに紐づくコメントスレッドを取得（ルートコメントとその返信を含む）
      const rootComments = comments.filter(c => c.highlightId === h.id && c.parentId === null);
      const childComments = comments.filter(c => rootComments.some(rc => rc.id === c.parentId));
      const allRelatedComments = [...rootComments, ...childComments];
      
      // コメントを作成日時で降順ソート（最新が先頭）
      // created_atが文字列、数値、Dateオブジェクトのいずれでも正しく動作するようにする
      const sortedComments = [...allRelatedComments].sort((a, b) => {
        const timeA = typeof a.created_at === 'string' || typeof a.created_at === 'number' 
          ? new Date(a.created_at).getTime() 
          : 0;
        const timeB = typeof b.created_at === 'string' || typeof b.created_at === 'number'
          ? new Date(b.created_at).getTime() 
          : 0;
        return timeB - timeA; // 降順（新しい順）
      });
      const latestComment = sortedComments[0];

      // スレッド内にLLMコメントが存在するかチェック
      const hasLLMComment = allRelatedComments.some(c => c.author === llmAuthorName);

      const colors = resolveHighlightColors(latestComment, hasLLMComment, llmAuthorName);

      const isActive = effectiveActiveHighlightId === h.id;

      return pageRects.map((rect, idx) => (
        <div
          key={`${h.id}-${idx}`}
          className={`${styles.highlightOverlay} ${isActive ? styles.active : styles.inactive}`}
          style={{
            left: `${rect.x1 * scale}px`,
            top: `${rect.y1 * scale}px`,
            width: `${(rect.x2 - rect.x1) * scale}px`,
            height: `${(rect.y2 - rect.y1) * scale}px`,
            backgroundColor: isActive ? colors.activeBg : colors.baseBg,
            border: `${isActive ? 3 : 2}px solid ${isActive ? colors.activeBorderColor : colors.baseBorderColor}`,
            boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.12)' : undefined,
          }}
        />
      ));
    });
  },[highlights, pageData, pageScales, effectiveActiveHighlightId, comments, llmAuthorName, resolveHighlightColors]);

  // 選択中ハイライトのプレビューを描画（キャンセル時は選択メニューが閉じられるため非表示）
  const renderPendingHighlight = useCallback((page: number) => {
    if (!selectionMenu.visible || !selectionMenu.pendingHighlight || selectionMenu.pendingHighlight.type !== 'pdf') return null;
    if (!pageData[page] || !pageScales[page]) return null;

    const scale = pageScales[page];
    const pendingRects = selectionMenu.pendingHighlight.rects.filter(r => r.pageNum === page);
    if (pendingRects.length === 0) return null;

    return pendingRects.map((rect, idx) => (
      <div
        key={`pending-${selectionMenu.pendingHighlight!.id}-${idx}`}
        className={styles.highlightOverlay}
        style={{
          left: `${rect.x1 * scale}px`,
          top: `${rect.y1 * scale}px`,
          width: `${(rect.x2 - rect.x1) * scale}px`,
          height: `${(rect.y2 - rect.y1) * scale}px`,
          backgroundColor: 'rgba(255, 235, 59, 0.35)',
          border: `2px dashed ${HIGHLIGHT_COLOR.USER_HIGHLIGHT_BASE_BORDER}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          pointerEvents: 'none',
          position: 'absolute',
        }}
      />
    ));
  }, [selectionMenu, pageData, pageScales]);

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
    const sel = window.getSelection();

    // selが null でないことを確認
    if (!sel) return;

    const target = e.target as HTMLElement;
    const clickedPageEl = target.closest('.react-pdf__Page');

    // --- ハイライトクリック検出ロジック ---
    // テキスト選択が行われなかった場合（単純クリックの場合）
    if(sel.isCollapsed) {
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
            logUserAction('pdf_highlight_clicked', {
              highlightId: clickedHighlight.id,
              pageNumber: pageNum,
              isLLMHighlight: clickedHighlight.createdBy === t("CommentPanel.comment-author-LLM"),
              timestamp: new Date().toISOString(),
            }, getUserId());

            // スクロールターゲット設定ロジック
            const rect = clickedHighlight.rects.find(r => r.pageNum === pageNum);
            if (viewerRef.current && rect) {
                const pageRect = clickedPageEl.getBoundingClientRect();
                const pageTopOffset = pageRect.top;
                const viewerY = pageTopOffset + (rect.y1 * pageScale);

                const scrollTarget = {
                    viewerY,
                    highlightId: clickedHighlight.id,
                    pageNum,
                    pdfY1: rect.y1,
                    pageScale,
                    pageTopOffset: pageTopOffset,
                };
                dispatch(setActiveScrollTarget(scrollTarget));
            }
            return; // ハイライト処理が完了したら終了
        }
    }

    // --- 既存のテキスト選択ロジック (ハイライトクリックでなかった場合のみ実行) ---
    const text = sel.toString().trim();
    if(!text) return;

    const range = sel.getRangeAt(0);
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

    logUserAction('pdf_text_selected', {
      pageNumber: pageNum,
      selectedTextLength: text.length,
      numberOfRects: allRects.length,
      timestamp: new Date().toISOString(),
    }, getUserId());

    sel.removeAllRanges();
  },[pageScales, highlights, dispatch, onHighlightClick, viewerRef, t, getUserId]);

  const handleRequestShapeHighlight = useCallback((rects: PdfRectWithPage[]) => {
    const firstRect = rects[0];

    setSelectionMenu({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        visible: true,
        pendingHighlight: {
            id: `pdf-shape-${Date.now()}`,
            type: "pdf",
            text: `図形/画像ハイライト (P${firstRect.pageNum})`,
            rects: rects,
            memo: "",
            createdAt: `${Date.now()}`,
            createdBy: `${t("CommentPanel.comment-author-user")}`
        }
    });

    logUserAction('pdf_shape_selected', {
      pageNumber: firstRect.pageNum,
      numberOfRects: rects.length,
      timestamp: new Date().toISOString(),
    }, getUserId());
  }, [t, getUserId]);

  const addHighlight = () => {
      if (selectionMenu.pendingHighlight) {
          onRequestAddHighlight?.(selectionMenu.pendingHighlight);
          setSelectionMenu(s => ({ ...s, visible: false, pendingHighlight: null }));
          logUserAction('pdf_selection_menu_add_highlight_clicked', {
            highlightText: selectionMenu.pendingHighlight.text.substring(0, 50),
            timestamp: new Date().toISOString(),
          }, getUserId());
      }
  };

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

  const updateCompletionStageOrThrow = useCallback(
    async (targetStage: number, failureStage: string): Promise<number> => {
      if (!documentId) {
        setErrorMessage(t('Error.document-id-missing'));
        logUserAction('analysis_failed', {
          stage: failureStage,
          reason: 'document_id_missing',
          timestamp: new Date().toISOString(),
        }, getUserId());
        throw new Error('document_id_missing');
      }

      const { data: updateResponse, error: updateError } = await apiClient<UpdateCompletionStageResponse>(
        `/documents/${documentId}/update-completion-stage/`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${session?.accessToken}` },
          body: {
            completion_stage: targetStage,
          }
        }
      );

      if (updateError) {
        setErrorMessage(t('Error.update-document-failed'));
        logUserAction('analysis_failed', {
          stage: failureStage,
          reason: updateError,
          timestamp: new Date().toISOString(),
        }, getUserId());
        throw new Error(String(updateError));
      }

      const stageValRaw = updateResponse?.completion_stage ?? updateResponse?.stage ?? targetStage;
      const stageVal = Number(stageValRaw);
      dispatch(setCompletionStage(Number.isNaN(stageVal) ? targetStage : stageVal));
      return Number.isNaN(stageVal) ? targetStage : stageVal;
    },
    [dispatch, documentId, getUserId, session?.accessToken, t],
  );

  const advanceToNextStage = useCallback(async (): Promise<boolean> => {
    if (!documentId) return true;

    let nextStage = completionStage;
    if (completionStage === STAGE.THINKING_PROCESS_SELF) {
      nextStage = STAGE.THINKING_OPTION_SELF;
    } else if (completionStage === STAGE.THINKING_OPTION_LLM) {
      nextStage = STAGE.THINKING_DELIBERATION_SELF;
    }

    try {
      await updateCompletionStageOrThrow(nextStage, `update_${completionStage}_to_${nextStage}_stage_error`);
      return true;
    } catch (error) {
      console.error('[advanceToNextStage] Stage update failed:', error);
      return false;
    }
  }, [completionStage, documentId, updateCompletionStageOrThrow]);

  const handleOptionSelfFlow = useCallback(async (): Promise<boolean> => {
    const highlightCommentThreads = buildHighlightThreads();

    const { data: formatDataResponse, error: formatDataError } = await apiClient<FormatDataResponse>(
      '/openai/format-data',
      {
        method: 'POST',
        body: {
          pdfTextData: {
            lines: groupedTextLines,
          },
        },
      }
    );

    if (formatDataError || !formatDataResponse) {
      setErrorMessage(t('Error.analysis-failed'));
      logUserAction('analysis_failed', {
        stage: 'format_data_error',
        reason: formatDataError || 'no_response',
        timestamp: new Date().toISOString(),
      }, getUserId());
      return false;
    }

    const firstResponseData = parseJSONResponse(formatDataResponse.analysis);

    if (!documentId) {
      setErrorMessage(t('Error.document-id-missing'));
      return false;
    }

    const { error: saveFormattedTextError } = await apiClient(
      `/documents/${documentId}/formatted-text`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
        body: {
          document_id: documentId,
          formatted_data: firstResponseData,
        },
      }
    );

    if (saveFormattedTextError) {
      setErrorMessage(t('Error.file-text-save-failed'));
      return false;
    }

    const userInput: OptionAnalyzeRequest = {
      mt_text: formatDataResponse.analysis,
      highlights: highlightCommentThreads,
    };

    const { data: optionAnalyzeResponse, error: optionAnalyzeError } = await apiClient<OptionAnalyzeResponse>(
      '/openai/option-analyze',
      {
        method: 'POST',
        body: {
          userInput,
        }
      }
    );

    if (optionAnalyzeError || !optionAnalyzeResponse) {
      setErrorMessage(t('Error.analysis-failed'));
      logUserAction('analysis_failed', {
        stage: 'option_analyze_error',
        reason: optionAnalyzeError || 'no_response',
        timestamp: new Date().toISOString(),
      }, getUserId());
      return false;
    }

    const responseData = parseJSONResponse(optionAnalyzeResponse.analysis);

    const highlight_feedback = Array.isArray(responseData?.highlight_feedback)
      ? responseData.highlight_feedback
      : [];
    const unhighlighted_feedback = Array.isArray(responseData?.unhighlighted_feedback)
      ? responseData.unhighlighted_feedback
      : [];

    for (const hf of highlight_feedback) {
      if (!hf.intervention_needed) continue;

      const rootComment = comments.find((c) => c.highlightId === hf.highlight_id && c.parentId === null);
      if (!rootComment) {
        console.error(
          `[handleOptionSelfFlow] No root comment found for highlight_id: ${hf.highlight_id}. Cannot create LLM response comment.`,
        );
        continue;
      }

      const { data: commentResponse, error: commentError } = await apiClient<CommentResponse>(
        '/comments/',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.accessToken}` },
          body: {
            highlight_id: parseInt(hf.highlight_id, 10),
            parent_id: parseInt(rootComment.id, 10),
            author: t("CommentPanel.comment-author-LLM"),
            text: hf.suggestion,
            suggestion_reason: hf.suggestion_reason,
            purpose: COMMENT_PURPOSE.OTHER_OPTIONS,
          }
        }
      );

      if (commentError || !commentResponse) {
        setErrorMessage(t('Error.comment-save-failed'));
        logUserAction('analysis_failed', {
          stage: 'save_highlight_comment',
          reason: commentError || 'no_response',
          timestamp: new Date().toISOString(),
        }, getUserId());
        return false;
      }

      dispatch(
        addComment({
          id: commentResponse.id.toString(),
          highlightId: hf.highlight_id,
          parentId: rootComment.id,
          author: t("CommentPanel.comment-author-LLM"),
          text: hf.suggestion,
          purpose: COMMENT_PURPOSE.OTHER_OPTIONS,
          created_at: commentResponse.created_at,
          edited_at: null,
          deleted: false,
        }),
      );
    }

    for (const uhf of unhighlighted_feedback) {
      if (!uhf.unhighlighted_text || !uhf.suggestion) continue;

      const foundRects = findTextInPdf(uhf.unhighlighted_text);
      if (foundRects.length === 0) continue;

      if (!documentId) {
        setErrorMessage(t('Error.document-id-missing'));
        logUserAction('analysis_failed', {
          stage: 'create_llm_highlight',
          reason: 'document_id_missing',
          timestamp: new Date().toISOString(),
        }, getUserId());
        return false;
      }

      const userName = t("CommentPanel.comment-author-LLM");
      const { data: highlightResponse, error: highlightError } = await apiClient<HighlightCreateResponse>(
        '/highlights/',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.accessToken}` },
          body: {
            document_file_id: fileId,
            created_by: userName,
            memo: uhf.suggestion,
            text: uhf.unhighlighted_text,
            suggestion_reason: uhf.suggestion_reason,
            purpose: COMMENT_PURPOSE.OTHER_OPTIONS,
            rects: foundRects.map((rect) => ({
              page_num: rect.pageNum,
              x1: rect.x1,
              y1: rect.y1,
              x2: rect.x2,
              y2: rect.y2,
            })),
            element_type: 'pdf',
          }
        }
      );

      if (highlightError || !highlightResponse) {
        setErrorMessage(t('Error.highlight-save-failed'));
        logUserAction('analysis_failed', {
          stage: 'save_llm_highlight',
          reason: highlightError || 'no_response',
          timestamp: new Date().toISOString(),
        }, getUserId());
        return false;
      }

      const llmHighlight: PdfHighlight = {
        id: highlightResponse.id.toString(),
        type: "pdf",
        text: uhf.unhighlighted_text,
        rects: foundRects,
        memo: uhf.suggestion,
        createdAt: highlightResponse.created_at,
        createdBy: t("CommentPanel.comment-author-LLM"),
      };

      const rootComment: CommentType = {
        id: highlightResponse.comment_id.toString(),
        highlightId: highlightResponse.id.toString(),
        parentId: null,
        author: t("CommentPanel.comment-author-LLM"),
        text: uhf.suggestion,
        purpose: COMMENT_PURPOSE.OTHER_OPTIONS,
        created_at: highlightResponse.created_at,
        edited_at: null,
        deleted: false,
      };

      dispatch(addHighlightWithComment({ highlight: llmHighlight, initialComment: rootComment }));
    }

    try {
      const stageVal = await updateCompletionStageOrThrow(
        STAGE.THINKING_OPTION_LLM,
        'update_completion_stage',
      );
      logUserAction('analysis_completed', {
        newCompletionStage: stageVal,
        timestamp: new Date().toISOString(),
      }, getUserId());
    } catch (error) {
      console.error('[handleOptionSelfFlow] Stage update failed:', error);
      return false;
    }

    return true;
  }, [
    buildHighlightThreads,
    comments,
    documentId,
    fileId,
    findTextInPdf,
    getUserId,
    groupedTextLines,
    session?.accessToken,
    t,
    updateCompletionStageOrThrow,
    dispatch,
  ]);

  const handleDeliberationSelfFlow = useCallback(async (): Promise<boolean> => {
    const highlightCommentThreads = buildHighlightThreads();
    const currentDocumentId = getDocumentId();

    if (!currentDocumentId) {
      setErrorMessage(t('Error.document-id-missing'));
      return false;
    }

    const { data: formattedTextData, error: formattedTextError } = await apiClient<DocumentFormattedTextRead>(
      `/documents/${currentDocumentId}/formatted-text`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      }
    );

    if (formattedTextError || !formattedTextData) {
      setErrorMessage(t('Error.analysis-failed'));
      return false;
    }

    const userInput: DeliberationAnalyzeRequest = {
      mt_text: formattedTextData.formatted_data,
      highlights: highlightCommentThreads,
    };

    const { data: deliberationResponse, error: deliberationError } = await apiClient<DeliberationAnalyzeResponse>(
      '/openai/deliberation-analyze',
      {
        method: 'POST',
        body: {
          userInput,
        }
      }
    );

    if (deliberationError || !deliberationResponse) {
      setErrorMessage(t('Error.analysis-failed'));
      logUserAction('analysis_failed', {
        stage: 'deliberation_api_error',
        reason: deliberationError || 'no_response',
        timestamp: new Date().toISOString(),
      }, getUserId());
      return false;
    }

    const responseData = parseJSONResponse(deliberationResponse.analysis);
    const suggestions = Array.isArray(responseData?.suggestions)
      ? responseData.suggestions
      : [];

    for (const s of suggestions) {
      if (!s.suggestion) continue;

      const rootComment = comments.find(
        (c) => c.highlightId === s.highlight_id && c.parentId === null,
      );

      if (!rootComment) {
        console.error(
          `[handleDeliberationSelfFlow] No root comment found for highlight_id: ${s.highlight_id}. Cannot create LLM response comment.`,
        );
        continue;
      }

      const { data: commentResponse, error: commentError } = await apiClient<CommentResponse>(
        '/comments/',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.accessToken}` },
          body: {
            highlight_id: parseInt(s.highlight_id, 10),
            parent_id: rootComment.id,
            author: t("CommentPanel.comment-author-LLM"),
            text: s.suggestion,
            suggestion_reason: s.suggestion_reason,
            purpose: COMMENT_PURPOSE.DELIBERATION,
          }
        }
      );

      if (commentError || !commentResponse) {
        setErrorMessage(t('Error.comment-save-failed'));
        logUserAction('analysis_failed', {
          stage: 'save_deliberation_comment',
          reason: commentError || 'no_response',
          timestamp: new Date().toISOString(),
        }, getUserId());
        return false;
      }

      dispatch(
        addComment({
          id: commentResponse.id.toString(),
          highlightId: s.highlight_id,
          parentId: rootComment.id.toString(),
          author: t("CommentPanel.comment-author-LLM"),
          text: s.suggestion,
          purpose: COMMENT_PURPOSE.DELIBERATION,
          created_at: commentResponse.created_at,
          edited_at: null,
          deleted: false,
        }),
      );
    }

    try {
      const stageVal = await updateCompletionStageOrThrow(
        STAGE.THINKING_DELIBERATION_LLM,
        'update_deliberation_stage',
      );
      logUserAction('deliberation_analysis_completed', {
        suggestionCount: suggestions.length,
        timestamp: new Date().toISOString(),
      }, getUserId());
    } catch (error) {
      console.error('[handleDeliberationSelfFlow] Stage update failed:', error);
      return false;
    }

    return true;
  }, [
    buildHighlightThreads,
    comments,
    getDocumentId,
    getUserId,
    session?.accessToken,
    t,
    updateCompletionStageOrThrow,
    dispatch,
  ]);

  const handleCompletion = useCallback(async () => {
    dispatch(startLoading(t('PdfViewer.analyzing')));
    dispatch(clearSelectedRootComments());
    logUserAction('analysis_started', {
      completionStage,
      highlightCount: highlights.length,
      commentCount: comments.length,
      timestamp: new Date().toISOString(),
    }, getUserId());

    try {
      const isSelfStage =
        completionStage === STAGE.THINKING_OPTION_SELF || completionStage === STAGE.THINKING_DELIBERATION_SELF;

      if (!isSelfStage) {
        await advanceToNextStage();
        return;
      }

      if (completionStage === STAGE.THINKING_OPTION_SELF) {
        await handleOptionSelfFlow();
      } else {
        await handleDeliberationSelfFlow();
      }
    } catch (error) {
      console.error('[handleCompletion] Unexpected error:', error);
      if (!errorMessage) setErrorMessage(t('Error.analysis-failed'));
      logUserAction('analysis_failed', {
        stage: 'unexpected_error',
        reason: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString(),
      }, getUserId());
    } finally {
      dispatch(stopLoading());
    }
  }, [
    advanceToNextStage,
    completionStage,
    dispatch,
    getUserId,
    handleDeliberationSelfFlow,
    handleOptionSelfFlow,
    highlights.length,
    comments.length,
    t,
    errorMessage,
  ]);

  const handleCompletionforExport = useCallback(async () => {
    dispatch(startLoading(t('PdfViewer.exporting')));
    logUserAction('export_started', {
      timestamp: new Date().toISOString(),
    }, getUserId());

    try {
      if (!documentId) {
        console.error('[handleCompletionforExport] Document ID not found');
        setErrorMessage(t('Error.document-id-missing'));
        logUserAction('export_failed', {
          reason: 'document_id_missing',
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }
      if (!fileId) {
        console.error('[handleCompletionforExport] File ID not found');
        setErrorMessage(t('Error.file-id-missing'));
        logUserAction('export_failed', {
          reason: 'file_id_missing',
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      console.log(`[Export][Frontend] Start. documentId=${documentId}, fileId=${fileId}, at=${new Date().toISOString()}`);

      // apiClient でblob形式で取得
      const { data: pdfBlob, error: exportError, status: exportStatus } = await apiClient<Blob>(
        `/documents/${documentId}/files/${fileId}/export/`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${session?.accessToken}` },
          responseType: 'blob',
        }
      );

      console.log(`[Export][Frontend] Export response: error=${!!exportError}, status=${exportStatus}`);

      if (exportError) {
        console.error(`[Export][Frontend] Export request failed. error=${exportError}`);
        setErrorMessage(t('Error.export-failed'));
        logUserAction('export_failed', {
          reason: 'export_api_error',
          error: exportError,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      if (!pdfBlob) {
        console.error('[Export][Frontend] No blob returned');
        setErrorMessage(t('Error.export-failed'));
        logUserAction('export_failed', {
          reason: 'no_blob_returned',
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      console.log('[Export][Frontend] Blob size:', (pdfBlob as Blob).size);

      // デフォルトのファイル名を生成
      const filename = 'export_with_comments.pdf';

      // ダウンロード処理
      const urlObj = window.URL.createObjectURL(pdfBlob as Blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(urlObj);
      console.log('[Export][Frontend] Download triggered & URL revoked');

      // ステージを EXPORT に更新
      const { data: updateResponse, error: updateError } = await apiClient<UpdateCompletionStageResponse>(
        `/documents/${documentId}/update-completion-stage/`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${session?.accessToken}` },
          body: {
            completion_stage: STAGE.EXPORT,
          }
        }
      );

      if (updateError) {
        console.error('[handleCompletionforExport] Stage update error:', updateError);
        setErrorMessage(t('Error.update-document-failed'));
        logUserAction('export_failed', {
          reason: 'stage_update_error',
          error: updateError,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      console.log('[Export][Frontend] Stage update response:', updateResponse);
      const stageValRaw = updateResponse?.completion_stage ?? updateResponse?.stage ?? STAGE.EXPORT;
      const stageVal = Number(stageValRaw);
      dispatch(setCompletionStage(Number.isNaN(stageVal) ? STAGE.EXPORT : stageVal));
      logUserAction('export_completed', {
        filename,
        blobSize: (pdfBlob as Blob).size,
        timestamp: new Date().toISOString(),
      }, getUserId());
      router.push('/documents');
    } catch (error) {
      console.error('[handleCompletionforExport] Error:', error);
      setErrorMessage(t('Error.export-failed'));
      logUserAction('export_failed', {
        reason: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString(),
      }, getUserId());
    } finally {
      console.log(`[Export][Frontend] End at ${new Date().toISOString()}`);
      dispatch(stopLoading());
    }
  }, [dispatch, fileId, t, getUserId, session?.accessToken, router, documentId]);

  const handleDialogue = useCallback(async () => {
    if (selectedRootCommentIds.length === 0) {
      console.warn('[handleDialogue] No comments selected');
      setErrorMessage(t('PdfViewer.no-comments-selected') || '対話するコメントが選択されていません');
      logUserAction('dialogue_no_comments_selected', {
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }

    dispatch(startLoading(t('PdfViewer.processing-dialogue') || '対話を処理中...'));
    logUserAction('dialogue_started', {
      selectedRootCommentCount: selectedRootCommentIds.length,
      completionStage,
      timestamp: new Date().toISOString(),
    }, getUserId());

    try {
      const selectedThreads: Array<{
        rootCommentId: string;
        highlightId: string | null;
        highlightText: string;
        comments: Array<{
          id: string;
          author: string;
          text: string;
          created_at: string;
        }>;
      }> = [];

      for (const rootCommentId of selectedRootCommentIds) {
        const rootComment = comments.find(c => c.id === rootCommentId && c.parentId === null);
        if (!rootComment) continue;

        const highlight = rootComment.highlightId
          ? highlights.find(h => h.id === rootComment.highlightId)
          : null;

        const threadComments = comments.filter(c => {
          if (c.id === rootCommentId) return true;
          if (c.parentId === rootCommentId) return true;
          let parent = comments.find(p => p.id === c.parentId);
          while (parent) {
            if (parent.id === rootCommentId) return true;
            parent = comments.find(p => p.id === parent?.parentId);
          }
          return false;
        }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        selectedThreads.push({
          rootCommentId,
          highlightId: rootComment.highlightId,
          highlightText: highlight?.text.trim() || '',
          comments: threadComments.map(c => ({
            id: c.id,
            author: c.author,
            text: c.text.trim(),
            created_at: c.created_at,
          })),
        });
      }

      let apiEndpoint: string;

      if (completionStage === STAGE.THINKING_OPTION_LLM) {
        apiEndpoint = '/openai/option-dialogue';
      } else if (completionStage === STAGE.THINKING_DELIBERATION_LLM) {
        apiEndpoint = '/openai/deliberation-dialogue';
      } else {
        console.error('[handleDialogue] Unsupported completion stage:', completionStage);
        setErrorMessage(t('Error.dialogue-failed'));
        logUserAction('dialogue_failed', {
          reason: 'unsupported_completion_stage',
          completionStage,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      // DBからフォーマット済みテキストを取得
      const documentId = getDocumentId();
      if (!documentId) {
        console.error('[handleDialogue] Document ID not found');
        setErrorMessage(t('Error.document-id-missing'));
        return;
      }

      const { data: formattedTextData, error: formattedTextError } = await apiClient<DocumentFormattedTextRead>(
        `/documents/${documentId}/formatted-text`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        }
      );

      if (formattedTextError || !formattedTextData) {
        console.error('[handleDialogue] Failed to fetch formatted text:', formattedTextError);
        setErrorMessage(t('Error.dialogue-failed'));
        return;
      }

      // formatted_dataをJSON文字列に変換
      const pdfTextData = typeof formattedTextData.formatted_data === 'string'
        ? formattedTextData.formatted_data
        : JSON.stringify(formattedTextData.formatted_data);

      const userInput = {
        pdf_text: pdfTextData,
        selected_threads: selectedThreads,
      };

      console.log(`[handleDialogue] Sending request to ${apiEndpoint}`);
      const { data: dialogueResponse, error: dialogueError } = await apiClient<DialogueResponse>(
        apiEndpoint,
        {
          method: 'POST',
          body: {
            userInput,
            purpose: completionStage === STAGE.THINKING_DELIBERATION_LLM
              ? COMMENT_PURPOSE.OTHER_OPTIONS
              : COMMENT_PURPOSE.DELIBERATION,
          }
        }
      );

      if (dialogueError || !dialogueResponse) {
        console.error('[handleDialogue] API error:', dialogueError);
        setErrorMessage(t('Error.dialogue-failed'));
        logUserAction('dialogue_failed', {
          reason: 'api_error',
          error: dialogueError || 'no_response',
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      const responseData = parseJSONResponse(dialogueResponse.analysis);

      // 未定義対策
      const dialogueResponses: any[] = Array.isArray(responseData?.dialogue_responses)
        ? responseData.dialogue_responses
        : [];

      if (dialogueResponses.length > 0) {

        for (const dr of dialogueResponses) {
          if (dr.root_comment_id && dr.response_text) {
            const rootComment = comments.find(c => c.id === dr.root_comment_id);
            if (!rootComment) {
              console.warn('[handleDialogue] Root comment not found:', dr.root_comment_id);
              continue;
            }

            const { data: commentResponse, error: commentError } = await apiClient<CommentResponse>(
              '/comments/',
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${session?.accessToken}` },
                body: {
                  highlight_id: rootComment.highlightId ? parseInt(rootComment.highlightId, 10) : null,
                  parent_id: parseInt(dr.root_comment_id, 10),
                  author: t("CommentPanel.comment-author-LLM"),
                  text: dr.response_text,
                  purpose: completionStage === STAGE.THINKING_DELIBERATION_LLM
                    ? COMMENT_PURPOSE.OTHER_OPTIONS
                    : COMMENT_PURPOSE.DELIBERATION,
                  completion_stage: completionStage,
                }
              }
            );

            if (commentError || !commentResponse) {
              console.error('[handleDialogue] Comment save error:', commentError);
              setErrorMessage(t('Error.comment-save-failed'));
              logUserAction('dialogue_failed', {
                reason: 'comment_save_error',
                error: commentError || 'no_response',
                timestamp: new Date().toISOString(),
              }, getUserId());
              return;
            }

            dispatch(
              addComment({
                id: commentResponse.id.toString(),
                highlightId: rootComment.highlightId,
                parentId: dr.root_comment_id,
                author: t("CommentPanel.comment-author-LLM"),
                text: dr.response_text,
                purpose: commentResponse.purpose ?? (completionStage === STAGE.THINKING_DELIBERATION_LLM
                  ? COMMENT_PURPOSE.OTHER_OPTIONS
                  : COMMENT_PURPOSE.DELIBERATION),
                completion_stage: commentResponse.completion_stage ?? completionStage,
                created_at: commentResponse.created_at,
                edited_at: null,
                deleted: false,
              })
            );
          }
        }

        dispatch(clearSelectedRootComments());
        logUserAction('dialogue_completed', {
          responseCount: responseData.dialogue_responses.length,
          timestamp: new Date().toISOString(),
        }, getUserId());
      } else {
        console.error('[handleDialogue] Invalid response format:', responseData);
        setErrorMessage(t('Error.invalid-response-format'));
        logUserAction('dialogue_failed', {
          reason: 'invalid_response_format',
          timestamp: new Date().toISOString(),
        }, getUserId());
      }
    } catch (error) {
      console.error('[handleDialogue] Error:', error);
      setErrorMessage(t('Error.dialogue-failed'));
      logUserAction('dialogue_failed', {
        reason: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString(),
      }, getUserId());
    } finally {
      dispatch(stopLoading());
    }
  }, [selectedRootCommentIds, comments, highlights, completionStage, dispatch, t, getUserId, session?.accessToken, getDocumentId]);

  return (
    <>
      <div
          style={{
            position:"relative",
            width:"100%",
          }}
          ref={viewerRef}
          onMouseUp={handleMouseUp}
        >
        {/* ローディングオーバーレイ */}
        <LoadingOverlay isVisible={isLoading} />

        {file?(
          <Document
            key={typeof file === 'string' ? file : (file as File)?.name ?? 'pdf'}
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
          >
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
                  renderAnnotationLayer={false}
                  renderTextLayer={true}
                  scale={pdfScale}
                />
                {renderHighlightVisuals(i + 1)}
                {renderPendingHighlight(i + 1)}
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
        ): <p style={{textAlign:'center'}}>{t("Alert.not-input-pdf")}</p> }

        {(selectionMenu.visible) && (completionStage !== STAGE.EXPORT) && (
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
          {completionStage !== STAGE.EXPORT && (
            <>
              {completionStage !== STAGE.THINKING_DELIBERATION_LLM && (
                <button
                  onClick={handleCompletion}
                  disabled={isLoading}
                  style={{
                      padding: '10px 20px',
                      fontSize: '16px',
                      backgroundColor: isLoading ? '#cccccc' : '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.6 : 1,
                      marginRight:
                        selectedRootCommentIds.length > 0 &&
                        (completionStage === STAGE.THINKING_OPTION_LLM || completionStage === STAGE.THINKING_DELIBERATION_LLM)
                          ? '10px'
                          : '0',
                  }}
                >
                  {t("PdfViewer.complete")}
                </button>
              )}

              {selectedRootCommentIds.length > 0 &&
              (completionStage === STAGE.THINKING_OPTION_LLM || completionStage === STAGE.THINKING_DELIBERATION_LLM) && (
                <button
                  onClick={handleDialogue}
                  disabled={isLoading}
                  style={{
                    padding: '10px 20px',
                    fontSize: '16px',
                    backgroundColor: isLoading ? '#cccccc' : '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                    marginRight: '10px',
                  }}
                >
                  {t("PdfViewer.dialogue")}
                </button>
              )}
            </>
          )}

          {(completionStage === STAGE.THINKING_DELIBERATION_LLM || completionStage === STAGE.EXPORT) && (
            <button
              onClick={handleCompletionforExport}
              disabled={isLoading}
              style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: isLoading ? '#cccccc' : '#666666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
              }}
            >
              {(completionStage === STAGE.THINKING_DELIBERATION_LLM) ? t("PdfViewer.finish") : t("PdfViewer.export-again")}
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <ErrorDisplay
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </>
  );
};

export default PdfViewer;