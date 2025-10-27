// src/components/HighlightMemoModal.tsx
import React, { useState, useEffect, MouseEvent } from 'react';

interface HighlightMemoModalProps {
  highlightId: string | null;
  currentMemo: string;
  onClose: () => void;
  onSave: (id: string, memo: string) => void;
}

const HighlightMemoModal: React.FC<HighlightMemoModalProps> = ({ highlightId, currentMemo, onClose, onSave }) => {
  const [memoText, setMemoText] = useState<string>(currentMemo || '');

  useEffect(() => {
    setMemoText(currentMemo || '');
  }, [currentMemo, highlightId]);

  const handleSave = () => {
    if (highlightId) {
      onSave(highlightId, memoText);
    }
  };

  if (!highlightId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e: MouseEvent) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>メモ</h2>
        <textarea
          value={memoText}
          onChange={(e) => setMemoText(e.target.value)}
          placeholder="ここにメモを入力..."
          rows={5}
        />
        <button onClick={handleSave}>保存</button>
        <button onClick={onClose} style={{ marginLeft: '10px', backgroundColor: '#6c757d' }}>
          キャンセル
        </button>
      </div>
    </div>
  );
};

export default HighlightMemoModal;