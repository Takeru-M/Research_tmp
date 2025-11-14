import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/LoadingOverlay.css';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message }) => {
  const { t } = useTranslation();

  if (!isVisible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-container">
        <div className="loading-spinner" />
        <p className="loading-text">
          {message || t('LoadingOverlay.analyzing')}
        </p>
        <p className="loading-subtext">
          {t('LoadingOverlay.please-wait')}
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;