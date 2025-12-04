import React from 'react';
import styles from '../styles/ErrorDispaly.module.css'
import { useTranslation } from "react-i18next";

interface ErrorDisplayProps {
  title?: string;
  message: string;
  onClose?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title = 'エラー',
  message,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.errorOverlay}>
      <div className={styles.errorContainer}>
        <div className={styles.errorHeader}>
          <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h2 className={styles.errorTitle}>{title}</h2>
          {onClose && (
            <button className={styles.closeButton} onClick={onClose} aria-label={t("Utils.close")}>
              ×
            </button>
          )}
        </div>
        <div className={styles.errorBody}>
          <p className={styles.errorMessage}>{message}</p>
        </div>
      </div>
    </div>
  );
};