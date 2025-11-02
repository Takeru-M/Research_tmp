// src/components/PdfViewer.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import { PdfHighlight, Highlight, Comment, PdfRectWithPage } from '../redux/features/editor/editorTypes'; 
import { useSelector } from 'react-redux';
import { selectActiveHighlightId, selectActiveCommentId } from '../redux/features/editor/editorSelectors';
import { setActiveHighlightId, setActiveCommentId } from '../redux/features/editor/editorSlice';
import FabricShapeLayer from './FabricShapeLayer';
import { extractShapeData } from '../utils/pdfShapeExtractor';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// --- ページデータ構造の定義 ---
interface PageLoadData {
  width: number;
  height: number;
  viewport: PageViewport;
}

interface PdfViewerProps {
  file: string | null;
  highlights: PdfHighlight[];
  comments: Comment[];
  onRequestAddHighlight?: (highlight: PdfHighlight) => void;
  onHighlightClick?: (highlightId: string) => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({
  file,
  highlights,
  comments,
  onRequestAddHighlight,
  onHighlightClick,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageData, setPageData] = useState<{ [n:number]:PageLoadData }>({}); 
  const [pageScales, setPageScales] = useState<{ [n:number]:number }>({});
  const [pageShapeData, setPageShapeData] = useState<{ [n:number]:PdfRectWithPage[] }>({});

  const viewerRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();

  const [selectionMenu, setSelectionMenu] = useState({
    x: 0, y: 0, visible: false, pendingHighlight: null as PdfHighlight|null
  });

  // Redux: active selections (省略)
  const activeHighlightId = useSelector(selectActiveHighlightId);
  const activeCommentId = useSelector(selectActiveCommentId);

  const activeHighlightFromComment = React.useMemo(() => {
    if (!activeCommentId) return null;
    const c = comments.find((x) => x.id === activeCommentId);
    return c ? c.highlightId : null;
  }, [activeCommentId, comments]);

  const effectiveActiveHighlightId = activeHighlightId ?? activeHighlightFromComment ?? null;

  // PDF以外クリックで選択解除 (省略)
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
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!selectionMenu.visible) return;

    const handleMenuClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // メニュー要素自体、またはその子要素へのクリックであれば何もしない
      if (target.closest('.pdf-add-menu')) {
        return;
      }

      // それ以外（画面上のどこであっても）でクリックされた場合はメニューを閉じる
      setSelectionMenu(s => ({ ...s, visible: false, pendingHighlight: null }));
    };
    document.addEventListener('mousedown', handleMenuClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleMenuClickOutside);
    };
  }, [selectionMenu.visible]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: PDFDocumentProxy) => {
    setNumPages(numPages);
  }, []);

  const onPageLoadSuccess = useCallback(async (page:PDFPageProxy, n:number)=>{
    // 1. scale 1 の viewport と dimensions を保存
    const viewport = page.getViewport({ scale:1 });
    // setStateを安全な関数形式にし、即座に実行
    setPageData(p=>({...p,[n]:{width:viewport.width,height:viewport.height,viewport}}));

    // 2. 図形情報を抽出
    try {
        const shapes = await extractShapeData(page);
        // setStateを安全な関数形式にし、即座に実行
        setPageShapeData(p => ({ ...p, [n]: shapes }));
    } catch (error) {
        console.error(`Error extracting shapes for page ${n}:`, error);
        setPageShapeData(p => ({ ...p, [n]: [] }));
    }

  },[]);

  // 💡 再挿入: PDFページのレンダリングが完了した後、その寸法からスケールを計算するロジック
  useEffect(()=>{
    if(!viewerRef.current||!numPages) return;
    let nScales:any={}, changed=false;
    for(let i=1;i<=numPages;i++){
      const dim=pageData[i];
      if(!dim) continue;
      // Pageコンポーネントが描画したCanvasの実際の幅を取得
      const el = viewerRef.current.querySelector(`.react-pdf__Page[data-page-number="${i}"]`);
      const cv = el?.querySelector("canvas") as HTMLCanvasElement|null;
      const w=cv?.offsetWidth;

      if(w && dim.width){
        const s=w/dim.width;
        // 誤差を考慮して比較し、変更があれば更新
        if(Math.abs((pageScales[i]||0) - s) > 0.001){
            nScales[i]=s; changed=true;
        }
      }
    }
    if(changed) setPageScales(p=>({...p,...nScales}));
  },[numPages,pageData,pageScales]);

  // scroll PDF to show active highlight (省略)

  const renderHighlightOverlays = useCallback((page:number)=>{
    if(!pageData[page]||!pageScales[page]) return null;
    const scale = pageScales[page];

    return highlights
      .filter(h => h.rects.some(r => r.pageNum===page))
      .flatMap(h => h.rects
        .filter(r => r.pageNum===page)
        .map((r,idx)=>{
          const isActive = effectiveActiveHighlightId === h.id;
          const style={
            position:'absolute' as const,
            left:r.x1*scale,
            top:r.y1*scale,
            width:(r.x2-r.x1)*scale,
            height:(r.y2-r.y1)*scale,
            background: isActive ? 'rgba(255,200,0,0.65)' : 'rgba(255,235,59,0.35)',
            borderRadius:2,
            cursor:'pointer',
            zIndex: isActive ? 20 : 8,
            boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.12)' : undefined,
          };
          return (
            <div
              key={`${h.id}-${idx}`}
              data-highlight-id={h.id}
              className='highlight'
              style={style}
              onClick={e=>{
                e.stopPropagation();
                onHighlightClick?.(h.id);
              }}
            />
          );
        }));
  },[highlights,pageData,pageScales,onHighlightClick,effectiveActiveHighlightId]);


  // TextNode対応 helper (省略)
  const getClosestPageElement = (node: Node): HTMLElement | null => {
    const el =
      node.nodeType === Node.TEXT_NODE
        ? (node.parentElement ?? null)
        : (node as HTMLElement);

    return el?.closest('.react-pdf__Page') ?? null;
  };

  // handleMouseUp (省略)
  const handleMouseUp = useCallback((e:React.MouseEvent)=>{
    const sel=window.getSelection();
    if(!sel||sel.isCollapsed) return;
    const text=sel.toString().trim();
    if(!text) return;

    const range=sel.getRangeAt(0);
    const rects=Array.from(range.getClientRects()).filter(r=>r.width>0&&r.height>0);
    if(rects.length===0) return;

    const firstRect=rects[0];
    const parent = getClosestPageElement(range.startContainer);
    if(!parent){ sel.removeAllRanges(); return;}

    const pageNum = Number(parent.getAttribute('data-page-number'));
    const pRect = parent.getBoundingClientRect();
    const scale = pageScales[pageNum]||1;

    const allRects: PdfRectWithPage[] = rects.map(r=>({
      pageNum,
      x1:(r.left-pRect.left)/scale,
      y1:(r.top-pRect.top)/scale,
      x2:(r.right-pRect.left)/scale,
      y2:(r.bottom-pRect.top)/scale,
    }));

    setSelectionMenu({
      x: Math.min(window.innerWidth-80, firstRect.right+8),
      y: firstRect.top-10,
      visible: true,
      pendingHighlight:{
        id:`pdf-${Date.now()}`, type:"pdf", text, rects:allRects, memo:""
      }
    });

    sel.removeAllRanges();
  },[pageScales]);

  // useEffect(selectionMenuの閉じ処理) (省略)

  const addHighlight = ()=>{
    if(selectionMenu.pendingHighlight){
      onRequestAddHighlight?.(selectionMenu.pendingHighlight);
      setSelectionMenu(s=>({...s,visible:false,pendingHighlight:null}));
    }
  };

  // --- 図形ハイライトをリクエストするハンドラ (省略) ---
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
        memo:""
      }
    });
  }, []);

  // 完了ボタンのクリックハンドラ（OpenAI APIリクエスト）
  const handleCompletion = useCallback(async () => {
    // ハイライトされた全テキストとコメントを結合してプロンプトを作成
    // const allText = highlights.map(h => h.text).join('\n---\n');
    // const allComments = comments.map(c => `[Comment for ${c.highlightId}]: ${c.content}`).join('\n');

    // const instruction = `以下のPDFのハイライトとコメントを分析し、要点をまとめてください。
    // \n\n---ハイライト---\n${allText}
    // \n\n---コメント---\n${allComments}`;

    const instruction = "Hello";

    try {
        // ⭐ 修正: 自身のAPI Routeへリクエスト
        const response = await axios.post('/api/analyze', {
            instruction: instruction
        });

        console.log('Analysis Success:', response.data);

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('API Route Error:', error.response?.data || error.message);
        } else {
            console.error('An unexpected error occurred:', error);
        }
    }
}, [highlights, comments]);

  return (
<div style={{position:"relative",width:"100%",height:"100%", overflowY: 'auto'}} ref={viewerRef} onMouseUp={handleMouseUp}>
  {file?(
    <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
      {Array.from(new Array(numPages || 0), (_, i) =>
      <div key={i + 1} style={{ position: "relative", marginBottom: 12, width: '100%' }}>
        <Page
          pageNumber={i + 1}
          onLoadSuccess={(p: PDFPageProxy) => onPageLoadSuccess(p, i + 1)}
          renderAnnotationLayer={true}
          renderTextLayer={true}
        />

        {renderHighlightOverlays(i + 1)}

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
      <button style={{fontSize:12,padding:"2px 6px"}} onClick={addHighlight}>コメントを追加</button>
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
          完了する
      </button>
  </div>
</div>
  );
};

export default PdfViewer;