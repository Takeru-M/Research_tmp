// 使用はしているが，未実装のためおそらく役に立っていない
// src/components/FabricShapeLayer.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import * as fabric from 'fabric';
import { PdfRectWithPage } from '../redux/features/editor/editorTypes';
import type { PageViewport } from 'pdfjs-dist';

interface FabricShapeLayerProps {
  pageNumber: number;
  width: number;
  height: number;
  viewport: PageViewport;
  scale: number;
  shapeData: PdfRectWithPage[];
  onSelectShape: (rects: PdfRectWithPage[]) => void;
}

const FabricShapeLayer: React.FC<FabricShapeLayerProps> = ({
  width,
  height,
  viewport,
  scale,
  shapeData,
  onSelectShape,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasesRef = useRef<Record<string, fabric.Canvas>>({});

  const pdfRectToViewportBox = useCallback((rect: PdfRectWithPage) => {
    const tl = viewport.convertToViewportPoint(rect.x1, rect.y1);
    const br = viewport.convertToViewportPoint(rect.x2, rect.y2);
    const left = Math.min(tl[0], br[0]);
    const top = Math.min(tl[1], br[1]);
    const w = Math.abs(br[0] - tl[0]);
    const h = Math.abs(br[1] - tl[1]);
    return { left, top, w, h };
  }, [viewport]);

  // unified cleanup function
  const disposeAll = () => {
    const cvs = canvasesRef.current;
    if (cvs && typeof cvs === 'object') {
      Object.values(cvs)?.forEach?.((c) => {
        try { c.dispose(); } catch {}
      });
    }
    canvasesRef.current = {};
  };

  useEffect(() => {
    // cleanup on unmount / remount
    return () => {
      disposeAll();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // remove DOM nodes
    while (container.firstChild) container.removeChild(container.firstChild);
    disposeAll();

    shapeData.forEach((shape) => {
      const vp = pdfRectToViewportBox(shape);
      const pxLeft = vp.left * scale;
      const pxTop = vp.top * scale;
      const pxW = Math.max(8, vp.w * scale);
      const pxH = Math.max(8, vp.h * scale);

      const wrap = document.createElement('div');
      wrap.style.position = 'absolute';
      wrap.style.left = `${pxLeft}px`;
      wrap.style.top = `${pxTop}px`;
      wrap.style.width = `${pxW}px`;
      wrap.style.height = `${pxH}px`;
      wrap.style.pointerEvents = 'auto';
      wrap.style.background = 'transparent';
      wrap.style.zIndex = '1000';

      const canvasEl = document.createElement('canvas');
      canvasEl.width = Math.ceil(pxW);
      canvasEl.height = Math.ceil(pxH);
      canvasEl.style.width = `${pxW}px`;
      canvasEl.style.height = `${pxH}px`;
      canvasEl.style.display = 'block';
      canvasEl.style.pointerEvents = 'auto';
      wrap.appendChild(canvasEl);
      container.appendChild(wrap);

      // backgroundColor should be undefined in fabric v5
      const fCanvas = new fabric.Canvas(canvasEl, {
        backgroundColor: undefined,
        selection: false,
        renderOnAddRemove: false,
      });

      const rect = new fabric.Rect({
        left: 0,
        top: 0,
        width: pxW,
        height: pxH,
        fill: 'rgba(0,0,0,0)',
        stroke: 'rgba(0,120,215,0)',
        strokeWidth: 0,
        selectable: false,
        hoverCursor: 'pointer',
      });

      wrap.addEventListener('mouseenter', () => {
        rect.set({
          strokeWidth: 2,
          stroke: 'rgba(0,120,215,0.6)',
          fill: 'rgba(0,120,215,0.03)',
        });
        fCanvas.requestRenderAll();
      });
      wrap.addEventListener('mouseleave', () => {
        rect.set({
          strokeWidth: 0,
          stroke: 'rgba(0,120,215,0)',
          fill: 'rgba(0,0,0,0)',
        });
        fCanvas.requestRenderAll();
      });
      wrap.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectShape([shape]); // クリックした図形を選択
        // ここでハイライトを追加するロジックを呼び出す
        const highlightData = {
          id: `shape-${Date.now()}`,
          type: "shape",
          text: "図形ハイライト",
          rects: [shape], // 選択した図形の情報を使用
          memo: "",
          createdAt: `${Date.now()}`,
          createdBy: 'User'
        };
        // onRequestAddHighlightを呼び出してハイライトを追加
        // onRequestAddHighlight?.(highlightData);
      });

      fCanvas.add(rect);
      fCanvas.requestRenderAll();

      canvasesRef.current[shape.elementId ?? `${shape.pageNum}-${Math.random()}`] = fCanvas;
    });

    return () => disposeAll();
  }, [shapeData, scale, pdfRectToViewportBox, onSelectShape]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width * scale}px`,
        height: `${height * scale}px`,
        pointerEvents: 'auto',
      }}
      aria-hidden
    />
  );
};

export default FabricShapeLayer;
