// src/components/TextViewer.tsx
import React, { useRef, useEffect, useCallback, MouseEvent } from 'react';
import { TextHighlight, Highlight, SerializedRange } from '../redux/features/editor/editorTypes';

interface TextViewerProps {
  content: string;
  highlights: TextHighlight[];
  onAddHighlight: (highlight: Highlight) => void;
  onHighlightClick: (highlightId: string) => void;
}

const TextViewer: React.FC<TextViewerProps> = ({ content, highlights, onAddHighlight, onHighlightClick }) => {
  const viewerRef = useRef<HTMLDivElement>(null);

  // Rangeオブジェクトをシリアライズ (DOMパスとオフセットで保存)
  const serializeRange = useCallback((range: Range, rootElement: HTMLDivElement): SerializedRange => {
    const getPath = (node: Node | null): number[] => {
      let path: number[] = [];
      let currentNode: Node | null = node;
      while (currentNode && currentNode !== rootElement) {
        let sibling: Node | null = currentNode.previousSibling;
        let count = 0;
        while (sibling) {
          sibling = sibling.previousSibling;
          count++;
        }
        path.unshift(count);
        currentNode = currentNode.parentNode;
      }
      return path;
    };

    return {
      startContainerPath: getPath(range.startContainer),
      startOffset: range.startOffset,
      endContainerPath: getPath(range.endContainer),
      endOffset: range.endOffset,
    };
  }, []);

  // シリアライズされたRange情報を元にRangeオブジェクトを再構築
  const deserializeRange = useCallback((serializedRange: SerializedRange, rootElement: HTMLDivElement): Range | null => {
    if (!serializedRange) return null;

    const getNodeFromPath = (path: number[]): Node | null => {
      let node: Node | null = rootElement;
      for (const index of path) {
        if (!node || !node.childNodes[index]) return null;
        node = node.childNodes[index];
      }
      return node;
    };

    const startContainer = getNodeFromPath(serializedRange.startContainerPath);
    const endContainer = getNodeFromPath(serializedRange.endContainerPath);

    if (startContainer && endContainer) {
      const range = document.createRange();
      try {
        range.setStart(startContainer, serializedRange.startOffset);
        range.setEnd(endContainer, serializedRange.endOffset);
        return range;
      } catch (e) {
        console.error("Error deserializing range:", e);
        return null;
      }
    }
    return null;
  }, []);


  // ハイライトをDOMに再適用する関数
  useEffect(() => {
    if (!viewerRef.current) return;

    // 前回のハイライトを全て削除 (クリーンアップ)
    Array.from(viewerRef.current.querySelectorAll('.text-viewer-highlight')).forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
    });

    // 保存されたハイライトをDOMに適用
    highlights.forEach(h => {
      try {
        const range = deserializeRange(h.rangeInfo, viewerRef.current as HTMLDivElement);
        if (range) {
          const span = document.createElement('span');
          span.className = 'text-viewer-highlight';
          span.dataset.highlightId = h.id;
          span.onclick = (e: MouseEvent) => {
            e.stopPropagation();
            onHighlightClick(h.id);
          };
          range.surroundContents(span);
        }
      } catch (error) {
        console.error('Failed to apply highlight:', error, h);
      }
    });
  }, [highlights, onHighlightClick, deserializeRange]);

  // テキスト選択イベントを処理
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && viewerRef.current && viewerRef.current.contains(selection.anchorNode!)) {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString();

      if (selectedText.length > 0) {
        console.log('Selected Text:', selectedText);

        const newHighlight: TextHighlight = {
          id: `text-highlight-${Date.now()}`,
          type: 'text',
          text: selectedText,
          rangeInfo: serializeRange(range, viewerRef.current),
          memo: '',
        };
        onAddHighlight(newHighlight);

        selection.removeAllRanges();
      }
    }
  }, [onAddHighlight, serializeRange]);

  return (
    <div
      ref={viewerRef}
      className="text-viewer-content"
      onMouseUp={handleTextSelection}
      style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
    >
      {content}
    </div>
  );
};

export default TextViewer;