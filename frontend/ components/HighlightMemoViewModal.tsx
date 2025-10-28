import React from 'react';

interface HighlightMemoViewModalProps {
  memo: string;
  onClose: () => void;
}

const HighlightMemoViewModal: React.FC<HighlightMemoViewModalProps> = ({ memo, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>
          &times;
        </button>
        <h2>メモを確認</h2>
        <div
          style={{
            whiteSpace: 'pre-wrap',
            backgroundColor: '#f5f5f5',
            padding: '1rem',
            borderRadius: '8px',
            minHeight: '100px',
          }}
        >
          {memo || '（メモがありません）'}
        </div>
      </div>
    </div>
  );
};

export default HighlightMemoViewModal;
