// src/components/HighlightMemoViewModal.tsx
import React, { useState } from 'react';

interface HighlightMemoViewModalProps {
  highlightId?: string | null;
  memo: string;
  onClose: () => void;
  onEditSave: (id: string, memo: string) => void;
}

const HighlightMemoViewModal: React.FC<HighlightMemoViewModalProps> = ({
  highlightId,
  memo,
  onClose,
  onEditSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(memo);

  const handleSave = () => {
    if (highlightId) {
      onEditSave(highlightId, editValue);
      setIsEditing(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '1.5rem',
          width: '400px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
        }}
      >
        <button
          className="close-button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '14px',
            fontSize: '1.5rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
          }}
        >
          &times;
        </button>

        <h2>メモを確認</h2>

        {isEditing ? (
          <>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #ccc',
                resize: 'vertical',
              }}
            />
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button
                onClick={handleSave}
                style={{
                  marginRight: '0.5rem',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                保存
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditValue(memo);
                }}
                style={{
                  backgroundColor: '#ccc',
                  color: '#000',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
          </>
        ) : (
          <>
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
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                編集する
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HighlightMemoViewModal;
