// src/components/HighlightMemoModal.tsx
import React, { useState, useEffect, MouseEvent } from 'react';
import { useDispatch } from 'react-redux';
import { setActiveHighlightId } from '@/redux/features/editor/editorSlice';
import { useTranslation } from "react-i18next";

interface HighlightMemoModalProps {
  highlightId: string | null;
  currentMemo: string;
  onClose: () => void;
  onSave: (id: string, memo: string) => void;
}

const HighlightMemoModal: React.FC<HighlightMemoModalProps> = ({ highlightId, currentMemo, onClose, onSave }) => {
  const [memoText, setMemoText] = useState<string>(currentMemo || '');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const handleSave = () => {
    const trimmedMemo = memoText.trim();

    if (highlightId && trimmedMemo) {
      onSave(highlightId, memoText);
      dispatch(setActiveHighlightId(highlightId));
      setErrorMessage('');
    } else if (highlightId && !trimmedMemo) {
      setErrorMessage(t("Error.enter-memo"));
    }
  };

  if (!highlightId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e: MouseEvent) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>{t("HighlightCommentModal.comment-title")}</h2>
        <textarea
          value={memoText}
          onChange={(e) => {
            setMemoText(e.target.value);
            setErrorMessage('');
          }}
          placeholder={t("HighlightCommentModal.comment-placeholder")}
          rows={5}
        />
        {errorMessage && (
          <p style={{ color: 'red', marginTop: '10px' }}>
            {errorMessage}
          </p>
        )}
        <div style={{ marginTop: '15px' }}>
            <button onClick={handleSave}>{t("Utils.save")}</button>
            <button onClick={onClose} style={{ marginLeft: '10px', backgroundColor: '#6c757d' }}>{t("Utils.cancel")}</button>
        </div>
      </div>
    </div>
  );
};

export default HighlightMemoModal;