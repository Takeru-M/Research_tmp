// src/components/PdfViewer.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { PdfHighlight, Highlight } from '../redux/features/editor/editorTypes';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  file: string | null; // Blob URL
  highlights: PdfHighlight[];
  onAddHighlight: (highlight: Highlight) => void;
  onHighlightClick: (highlightId: string) => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file, highlights, onAddHighlight, onHighlightClick }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ [pageNum: number]: { width: number; height: number } }>({});
  // ★ NEW: ページのレンダリングされた幅に基づくスケールを保持するState
  const [pageScales, setPageScales] = useState<{ [pageNum: number]: number }>({}); 
  const viewerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: PDFDocumentProxy) => {
    setNumPages(numPages);
  }, []);

  const onPageLoadSuccess = useCallback((page: PDFPageProxy, pageNum: number) => {
    // 100%スケールでのPDFのオリジナル寸法
    const { width, height } = page.getViewport({ scale: 1 });
    setPageDimensions(prev => ({ ...prev, [pageNum]: { width, height } }));
  }, []);

  // ★ MODIFIED: useEffectでDOMアクセス（ref.currentの使用）を分離
  useEffect(() => {
    if (!viewerRef.current || !numPages) return;

    const newPageScales: { [pageNum: number]: number } = {};
    let changed = false;

    for (let i = 1; i <= numPages; i++) {
      const pageNum = i;
      const pageDim = pageDimensions[pageNum];
      if (!pageDim) continue;

      // ref.current にアクセスし、レンダリングされた canvas 要素を探す
      const pageCanvas = viewerRef.current.querySelector(`.react-pdf__Page[data-page-number="${pageNum}"] canvas`);
      
      const renderedWidth = pageCanvas?.offsetWidth; // DOMから実際の表示幅を取得

      if (renderedWidth && pageDim.width) {
        // 表示幅 / オリジナル幅 = スケール
        const scale = renderedWidth / pageDim.width;
        
        // スケールが変わった場合のみ更新
        if (pageScales[pageNum] !== scale) {
          newPageScales[pageNum] = scale;
          changed = true;
        }
      }
    }

    if (changed || Object.keys(newPageScales).length > 0) {
        setPageScales(prev => ({ ...prev, ...newPageScales }));
    }

  }, [numPages, pageDimensions]); // pageScales の変更は依存配列から除外（無限ループ防止のため）


  const renderHighlightOverlays = useCallback((pageNum: number) => {
    // pageDimensions と pageScales が利用可能かチェック
    if (!pageDimensions[pageNum] || !pageScales[pageNum]) return null;

    const pageHighlights = highlights.filter(h => h.pageNum === pageNum);
    const scale = pageScales[pageNum]; // ★ NEW: Stateから計算済みのスケール値を取得
    
    // 削除されたロジック:
    // const pageCanvas = viewerRef.current.querySelector(...);
    // const renderedWidth = pageCanvas?.offsetWidth || width;
    // const scale = renderedWidth / width; 

    // スケール値を使ってハイライトの位置とサイズを計算
    return pageHighlights.map(h => {
      const dummyRect = h.rects[0] || { x1: 50, y1: 50, x2: 150, y2: 70 };

      const left = dummyRect.x1 * scale;
      const top = dummyRect.y1 * scale;
      const overlayWidth = (dummyRect.x2 - dummyRect.x1) * scale;
      const overlayHeight = (dummyRect.y2 - dummyRect.y1) * scale;

      return (
        <div
          key={h.id}
          className="pdf-highlight-overlay"
          style={{
            left: `${left}px`,
            top: `${top}px`,
            width: `${overlayWidth}px`,
            height: `${overlayHeight}px`,
            // 視覚的なデバッグ用スタイル (必要に応じて追加)
            backgroundColor: 'rgba(255, 255, 0, 0.4)', 
            position: 'absolute',
            zIndex: 10,
            cursor: 'pointer',
          }}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onHighlightClick(h.id);
          }}
        ></div>
      );
    });
  }, [highlights, pageDimensions, pageScales, onHighlightClick]); // ★ MODIFIED: pageScales を依存配列に追加

  const addDummyHighlight = useCallback((pageNum: number) => {
    const selectedText = "Dummy PDF Highlight Text";
    const dummyHighlight: PdfHighlight = {
      id: `pdf-highlight-${Date.now()}`,
      type: 'pdf',
      text: selectedText,
      pageNum: pageNum,
      // ダミー rects は pageNum に応じて位置を変える
      rects: [{ x1: 50 + (pageNum * 10), y1: 50 + (pageNum * 10), x2: 150 + (pageNum * 10), y2: 70 + (pageNum * 10) }],
      memo: '',
    };
    onAddHighlight(dummyHighlight);
    alert(`Page ${pageNum}にダミーハイライトを追加しました。`);
  }, [onAddHighlight]);


  return (
    <div ref={viewerRef} className="pdf-viewer-container">
      {file ? (
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          className="react-pdf__Document"
        >
          {Array.from(new Array(numPages || 0), (el, index) => (
            <div 
                key={`page_${index + 1}`} 
                style={{ 
                    position: 'relative', 
                    marginBottom: '10px' 
                }}
            >
              <Page
                pageNumber={index + 1}
                onLoadSuccess={(page) => onPageLoadSuccess(page, index + 1)}
                renderAnnotationLayer={true}
                renderTextLayer={true}
                className="react-pdf__Page"
              />
              {/* レンダリングロジック内で renderHighlightOverlays を呼び出す */}
              {renderHighlightOverlays(index + 1)}

              <button
                onClick={() => addDummyHighlight(index + 1)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  zIndex: 11,
                  padding: '5px 10px',
                  fontSize: '0.8rem',
                }}
              >
                P{index + 1} ダミーハイライト追加
              </button>
            </div>
          ))}
        </Document>
      ) : (
        <p style={{ textAlign: 'center', marginTop: '1rem' }}>PDFファイルを読み込んでいません。</p>
      )}
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        {numPages ? `全 ${numPages} ページ` : 'PDFを読み込み中...'}
      </p>
    </div>
  );
};

export default PdfViewer;