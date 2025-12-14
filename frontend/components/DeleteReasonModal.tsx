import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/DeleteReasonModal.module.css';

interface DeleteReasonModalProps {
  isOpen: boolean;
  commentAuthor: string;
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const DeleteReasonModal: React.FC<DeleteReasonModalProps> = ({
  isOpen,
  commentAuthor,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError(t('Alert.delete-comment-reason-required'));
      return;
    }
    setError('');
    await onConfirm(reason.trim());
    setReason('');
  };

  const handleCancel = () => {
    setReason('');
    setError('');
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>
          {t('CommentPanel.delete-llm-comment')}
        </h2>
        <p className={styles.subtitle}>
          {t('CommentPanel.delete-llm-comment-reason-prompt')}
        </p>

        <textarea
          className={styles.reasonInput}
          placeholder={t('CommentPanel.delete-reason-placeholder')}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError('');
          }}
          disabled={isLoading}
        />

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.buttonGroup}>
          <button
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={isLoading}
          >
            {t('Utils.cancel')}
          </button>
          <button
            className={styles.confirmButton}
            onClick={handleConfirm}
            disabled={isLoading || !reason.trim()}
          >
            {isLoading ? t('Utils.loading') : t('Utils.delete')}
          </button>
        </div>
      </div>
    </div>
  );
};