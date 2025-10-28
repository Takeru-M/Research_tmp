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
  file: string | null;
  highlights: PdfHighlight[];
  onAddHighlight: (highlight: Highlight) => void;
  onRequestAddHighlight: (highlight: PdfHighlight) => void;
  onHighlightClick: (highlightId: string) => void;
}

// 🔹 「メモを追加」メニュー
const SelectionMenu: React.FC<{
  x: number;
  y: number;
  visible: boolean;
  onAddMemo: () => void;
  onClose: () => void;
}> = ({ x, y, visible, onAddMemo, onClose }) => {
  if (!visible) return null;

  return (
    <div
      id="selection-menu"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 9999,
        padding: '6px 10px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddMemo();
          onClose();
        }}
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: '0.9rem',
          color: 'black',
        }}
      >
        📝 メモを追加
      </button>
    </div>
  );
};

const PdfViewer: React.FC<PdfViewerProps> = ({
  file,
  highlights,
  onAddHighlight,
  onRequestAddHighlight,
  onHighlightClick,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ [pageNum: number]: { width: number; height: number } }>({});
  const [pageScales, setPageScales] = useState<{ [pageNum: number]: number }>({});
  const viewerRef = useRef<HTMLDivElement>(null);

  const [selectionMenu, setSelectionMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    pendingHighlight: PdfHighlight | null;
  }>({ x: 0, y: 0, visible: false, pendingHighlight: null });

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    highlightId: string | null;
  }>({ x: 0, y: 0, visible: false, highlightId: null });

  const [menuOpenTime, setMenuOpenTime] = useState<number>(0);

  const onDocumentLoadSuccess = useCallback(({ numPages }: PDFDocumentProxy) => {
    setNumPages(numPages);
  }, []);

  const onPageLoadSuccess = useCallback((page: PDFPageProxy, pageNum: number) => {
    const { width, height } = page.getViewport({ scale: 1 });
    setPageDimensions((prev) => ({ ...prev, [pageNum]: { width, height } }));
  }, []);

  // スケール更新
  useEffect(() => {
    if (!viewerRef.current || !numPages) return;
    const newScales: { [pageNum: number]: number } = {};
    let changed = false;
    for (let i = 1; i <= numPages; i++) {
      const dim = pageDimensions[i];
      if (!dim) continue;
      const pageCanvas = viewerRef.current.querySelector(`.react-pdf__Page[data-page-number="${i}"] canvas`);
      const renderedWidth = pageCanvas?.offsetWidth;
      if (renderedWidth && dim.width) {
        const scale = renderedWidth / dim.width;
        if (pageScales[i] !== scale) {
          newScales[i] = scale;
          changed = true;
        }
      }
    }
    if (changed) setPageScales((prev) => ({ ...prev, ...newScales }));
  }, [numPages, pageDimensions, pageScales]);

  // 右クリックメニュー
  const handleRightClick = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true, highlightId: id });
  }, []);

  // 外部クリックでメニューを閉じる
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      // 開いた直後(300ms以内)は無視
      if (Date.now() - menuOpenTime < 300) return;

      const target = e.target as HTMLElement;
      if (!target.closest('#selection-menu')) {
        setSelectionMenu((p) => ({ ...p, visible: false }));
        setContextMenu((p) => ({ ...p, visible: false }));
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpenTime]);

  // ハイライト描画
  const renderHighlightOverlays = useCallback(
    (pageNum: number) => {
      if (!pageDimensions[pageNum] || !pageScales[pageNum]) return null;
      const scale = pageScales[pageNum];
      return highlights
        .filter((h) => h.pageNum === pageNum)
        .map((h) => {
          const rect = h.rects[0];
          const left = rect.x1 * scale;
          const top = rect.y1 * scale;
          const width = (rect.x2 - rect.x1) * scale;
          const height = (rect.y2 - rect.y1) * scale;
          return (
            <div
              key={h.id}
              className="pdf-highlight-overlay"
              style={{
                position: 'absolute',
                left,
                top,
                width,
                height,
                backgroundColor: 'rgba(255, 255, 0, 0.35)',
                cursor: 'pointer',
                zIndex: 10,
              }}
              onContextMenu={(e) => handleRightClick(e, h.id)}
            />
          );
        });
    },
    [highlights, pageDimensions, pageScales, handleRightClick]
  );

  // 選択 → メニュー表示
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;

      const text = sel.toString().trim();
      if (!text) return;

      const range = sel.getRangeAt(0);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (rects.length === 0) return;
      const firstRect = rects[0];

      // 親ページ検出（TextNode対応）
      let parent: HTMLElement | null = null;
      const startNode = range.startContainer;
      if (startNode instanceof Element) {
        parent = startNode.closest('.react-pdf__Page');
      } else if ((startNode as any)?.parentElement) {
        parent = (startNode as any).parentElement.closest('.react-pdf__Page');
      }
      if (!parent) {
        const el = document.elementFromPoint(firstRect.left, firstRect.top) as HTMLElement | null;
        parent = el?.closest('.react-pdf__Page') || null;
      }
      if (!parent) return;

      const pageNum = Number(parent.getAttribute('data-page-number'));
      if (!pageNum) return;

      const pageRect = parent.getBoundingClientRect();
      const scale = pageScales[pageNum] || 1;

      const x1 = (firstRect.left - pageRect.left) / scale;
      const y1 = (firstRect.top - pageRect.top) / scale;
      const x2 = (firstRect.right - pageRect.left) / scale;
      const y2 = (firstRect.bottom - pageRect.top) / scale;

      const newHighlight: PdfHighlight = {
        id: `pdf-highlight-${Date.now()}`,
        type: 'pdf',
        text,
        pageNum,
        rects: [{ x1, y1, x2, y2 }],
        memo: '',
      };

      // メニューを表示
      setSelectionMenu({
        x: firstRect.right + 8,
        y: Math.max(firstRect.top - 35, 10),
        visible: true,
        pendingHighlight: newHighlight,
      });
      setMenuOpenTime(Date.now()); // ← 追加：メニューオープン時刻を記録

      sel.removeAllRanges();
    },
    [pageScales]
  );

  return (
    <div
      ref={viewerRef}
      className="pdf-viewer-container"
      style={{ position: 'relative' }}
      onMouseUp={handleMouseUp}
    >
      {file ? (
        <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
          {Array.from(new Array(numPages || 0), (_, i) => (
            <div key={i + 1} style={{ position: 'relative', marginBottom: '10px' }}>
              <Page
                pageNumber={i + 1}
                onLoadSuccess={(page) => onPageLoadSuccess(page, i + 1)}
                renderAnnotationLayer
                renderTextLayer
              />
              {renderHighlightOverlays(i + 1)}
            </div>
          ))}
        </Document>
      ) : (
        <p style={{ textAlign: 'center' }}>PDFファイルを読み込んでいません。</p>
      )}

      {/* 🔹 メモ追加メニュー */}
      <SelectionMenu
        x={selectionMenu.x}
        y={selectionMenu.y}
        visible={selectionMenu.visible}
        onAddMemo={() => {
          if (selectionMenu.pendingHighlight) {
            onRequestAddHighlight(selectionMenu.pendingHighlight);
          }
        }}
        onClose={() => setSelectionMenu((p) => ({ ...p, visible: false }))}
      />

      {/* 🔹 メモ閲覧（右クリックメニュー） */}
      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '6px',
            padding: '6px 10px',
            zIndex: 9999,
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            color: '#000',
          }}
          // ✅ デフォルト右クリック無効化
          onContextMenu={(e) => e.preventDefault()}
          // ✅ イベント捕捉を確実に停止
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              // ✅ mousedown で捕捉（click より先に動作）
              e.stopPropagation();
              e.preventDefault();

              if (contextMenu.highlightId) {
                console.log('✅ メモ確認ボタン押下:', contextMenu.highlightId);
                onHighlightClick(contextMenu.highlightId);
              } else {
                console.warn('⚠ contextMenu.highlightId が未定義');
              }

              // ✅ メニューを確実に閉じる
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.9rem',
              color: '#000',
              padding: '4px 8px',
              width: '100%',
              textAlign: 'left',
            }}
          >
            メモを確認
          </button>
        </div>
      )}

    </div>
  );
};

export default PdfViewer;
