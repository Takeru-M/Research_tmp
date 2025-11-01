// src/components/PdfViewer.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useDispatch } from 'react-redux';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { PdfHighlight, Highlight, Comment } from '../redux/features/editor/editorTypes';
import { useSelector } from 'react-redux';
import { selectActiveHighlightId, selectActiveCommentId } from '../redux/features/editor/editorSelectors';
import { setActiveHighlightId, setActiveCommentId } from '../redux/features/editor/editorSlice';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

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
  const [pageDimensions, setPageDimensions] = useState<{ [n:number]:{width:number;height:number} }>({});
  const [pageScales, setPageScales] = useState<{ [n:number]:number }>({});
  const viewerRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();

  const [selectionMenu, setSelectionMenu] = useState({
    x: 0, y: 0, visible: false, pendingHighlight: null as PdfHighlight|null
  });

  // Redux: active selections
  const activeHighlightId = useSelector(selectActiveHighlightId);
  const activeCommentId = useSelector(selectActiveCommentId);

  // derive highlight id from activeCommentId (comments prop)
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

      // PDF内 or 選択メニューをクリックしたら解除しない
      if (
        viewerRef.current?.contains(target) ||
        target.closest('.pdf-add-menu') || 
        target.closest('.react-pdf__Page') // PDFページ内
      ) {
        return;
      }

      // その他領域クリック時は解除
      dispatch(setActiveHighlightId(null));
      dispatch(setActiveCommentId(null));
    };

  document.addEventListener('mousedown', handleClickOutside);

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [dispatch]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: PDFDocumentProxy) => {
    setNumPages(numPages);
  }, []);

  const onPageLoadSuccess = useCallback((page:PDFPageProxy, n:number)=>{
    const {width,height} = page.getViewport({ scale:1 });
    setPageDimensions(p=>({...p,[n]:{width,height}}));
  },[]);

  useEffect(()=>{
    if(!viewerRef.current||!numPages) return;
    let nScales:any={}, changed=false;
    for(let i=1;i<=numPages;i++){
      const dim=pageDimensions[i];
      if(!dim) continue;
      const el = viewerRef.current.querySelector(`.react-pdf__Page[data-page-number="${i}"]`);
      const cv = el?.querySelector("canvas") as HTMLCanvasElement|null;
      const w=cv?.offsetWidth;
      if(w && dim.width){
        const s=w/dim.width;
        if(pageScales[i]!==s){ nScales[i]=s; changed=true; }
      }
    }
    if(changed) setPageScales(p=>({...p,...nScales}));
  },[numPages,pageDimensions,pageScales]);

  // scroll PDF to show active highlight (center page)
  useEffect(() => {
    if (!effectiveActiveHighlightId || !viewerRef.current) return;
    const h = highlights.find((x) => x.id === effectiveActiveHighlightId);
    if (!h || h.rects.length === 0) return;
    // pick first rect's page
    const pageNum = h.rects[0].pageNum;
    const pageEl = viewerRef.current.querySelector(`.react-pdf__Page[data-page-number="${pageNum}"]`) as HTMLElement | null;
    if (pageEl) {
      // scroll page element into view inside viewer's scroll container (if viewer has scrolling)
      // If viewerRef is document-level (not scrollable) fallback to window scrollIntoView
      const container = viewerRef.current;
      const pageRect = pageEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      // compute top relative to container scroll
      const relativeTop = pageEl.offsetTop; // offsetTop relative to nearest positioned ancestor (react-pdf pages are direct children)
      if (container.scrollTo) {
        container.scrollTo({ top: Math.max(0, relativeTop - container.clientHeight / 2), behavior: 'smooth' });
      } else {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [effectiveActiveHighlightId, highlights]);

  const renderHighlightOverlays = useCallback((page:number)=>{
    if(!pageDimensions[page]||!pageScales[page]) return null;
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
              style={style}
              onClick={e=>{
                e.stopPropagation();
                // let parent handle state changes
                onHighlightClick?.(h.id);
              }}
            />
          );
        }));
  },[highlights,pageDimensions,pageScales,onHighlightClick,effectiveActiveHighlightId]);

  // TextNode対応 helper
  const getClosestPageElement = (node: Node): HTMLElement | null => {
    const el =
      node.nodeType === Node.TEXT_NODE
        ? (node.parentElement ?? null)
        : (node as HTMLElement);

    return el?.closest('.react-pdf__Page') ?? null;
  };

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

    const allRects = rects.map(r=>({
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

  useEffect(()=>{
    const close=(e:MouseEvent)=>{
      if(!(e.target as HTMLElement).closest(".pdf-add-menu")){
        setSelectionMenu(m=>({...m,visible:false}));
      }
    };
    document.addEventListener("mousedown",close);
    return()=>document.removeEventListener("mousedown",close);
  },[]);

  const addHighlight = ()=>{
    if(selectionMenu.pendingHighlight){
      onRequestAddHighlight?.(selectionMenu.pendingHighlight);
      setSelectionMenu(s=>({...s,visible:false,pendingHighlight:null}));
    }
  };

  return (
<div style={{position:"relative",width:"100%",height:"100%", overflowY: 'auto'}} ref={viewerRef} onMouseUp={handleMouseUp}>
  {file?(
    <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
      {Array.from(new Array(numPages||0),( _,i)=>
        <div key={i+1} style={{position:"relative",marginBottom:12}}>
          <Page pageNumber={i+1} onLoadSuccess={p=>onPageLoadSuccess(p,i+1)}
                renderAnnotationLayer renderTextLayer />
          {renderHighlightOverlays(i+1)}
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
</div>
  );
};

export default PdfViewer;
