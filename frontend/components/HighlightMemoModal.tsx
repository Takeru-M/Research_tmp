// src/components/HighlightMemoModal.tsx
import React, { useState, MouseEvent } from 'react';
import { useDispatch } from 'react-redux';
import { setActiveHighlightId } from '@/redux/features/editor/editorSlice';
import { useTranslation } from "react-i18next";
import styles from '../styles/HighlightMemoModal.module.css';

interface HighlightMemoModalProps {
  highlightId: string | null;
  currentMemo: string;
  onClose: () => void;
  onSave: (id: string, memo: string) => void;
}

const HighlightMemoModal: React.FC<HighlightMemoModalProps> = ({
  highlightId,
  currentMemo,
  onClose,
  onSave
}) => {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!highlightId) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e: MouseEvent) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          &times;
        </button>
        
        <h2 className={styles.title}>
          {t("HighlightCommentModal.comment-title")}
        </h2>
        
        <textarea
          value={memoText}
          onChange={(e) => {
            setMemoText(e.target.value);
            setErrorMessage('');
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("HighlightCommentModal.comment-placeholder")}
          rows={5}
          className={styles.textarea}
          autoFocus
        />
        
        {errorMessage && (
          <p className={styles.errorMessage}>
            {errorMessage}
          </p>
        )}
        
        <div className={styles.buttonContainer}>
          <button onClick={onClose} className={styles.cancelButton}>
            {t("Utils.cancel")}
          </button>
          <button onClick={handleSave} className={styles.saveButton}>
            {t("Utils.save")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HighlightMemoModal;