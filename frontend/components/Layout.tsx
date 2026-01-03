import Head from 'next/head';
import React, { ChangeEvent, PropsWithChildren, useCallback, useState, useEffect } from 'react';
import styles from '../styles/Layout.module.css';
import { Trans, useTranslation } from "react-i18next";
import { useSelector, useDispatch } from 'react-redux';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { RootState } from '@/redux/rootReducer';
import { setPdfScale, clearAllState, setHasSoftDeletedLLMComment, triggerLLMCommentRefresh, triggerSoftDeleteFlagCheck } from '../redux/features/editor/editorSlice';
import { SCALE_OPTIONS } from '@/utils/constants';
import { apiClient } from '@/utils/apiClient';
import { useLogout } from '@/hooks/useLogout';

const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { logout } = useLogout();
  const isAuthenticated = status === 'authenticated';
  const pdfScale = useSelector((state: RootState) => state.editor.pdfScale);
  const documentName = useSelector((state: RootState) => state.editor.documentName);
  const hasSoftDeletedLLM = useSelector((state: RootState) => state.editor.hasSoftDeletedLLMComment);
  const completionStage = useSelector((state: RootState) => state.editor.completionStage);

  const isAuthPage = ['/login', '/signup'].includes(router.pathname);
  const isDocumentsPage = router.pathname === '/documents';

  const [restoring, setRestoring] = useState(false);

  const fileId = useSelector((state: RootState) => state.editor.fileId);

  // ソフトデリート済みLLMコメント存在チェック用の関数
  const fetchSoftDeletedFlag = useCallback(async () => {
    if (!isAuthenticated || router.pathname !== '/') return;

    const { data, error } = await apiClient<{ exists: boolean }>('/comments/llm/soft-deleted/exists/', {
      method: 'GET',
      headers: { Authorization: `Bearer ${session?.accessToken}` },
    });
    if (!error && data) {
      dispatch(setHasSoftDeletedLLMComment(Boolean(data.exists)));
    }
  }, [isAuthenticated, router.pathname, session?.accessToken, dispatch]);

  const handleScaleChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const newScale = parseFloat(event.target.value);
    dispatch(setPdfScale(newScale));
  }, [dispatch]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const handleBackToDocuments = useCallback(() => {
    dispatch(clearAllState());
    router.push('/documents');
  }, [router, dispatch]);

  const handleRestoreLLMComment = useCallback(async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const { data, error } = await apiClient('/comments/llm/soft-deleted/restore-latest/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (!error && data) {
        dispatch(setHasSoftDeletedLLMComment(false));
        dispatch(triggerLLMCommentRefresh());
      }
    } finally {
      setRestoring(false);
    }
  }, [dispatch, restoring, session?.accessToken]);

  // ページ初期ロード時にソフトデリート済みLLMコメントをチェック
  useEffect(() => {
    fetchSoftDeletedFlag();
  }, [isAuthenticated, router.pathname, session?.accessToken, dispatch]);

  // LLMコメント削除後のフラグチェックトリガーを監視
  const lastSoftDeleteFlagCheckTime = useSelector((state: RootState) => state.editor.lastSoftDeleteFlagCheckTime);

  useEffect(() => {
    if (lastSoftDeleteFlagCheckTime !== null && isAuthenticated && router.pathname === '/') {
      console.log('[useEffect] Soft delete flag check triggered, refetching flag');
      fetchSoftDeletedFlag();
    }
  }, [lastSoftDeleteFlagCheckTime, isAuthenticated, router.pathname, fetchSoftDeletedFlag]);

  if (status === 'loading') {
    return null;
  }

  return (
    <>
      <Head>
        <title>{t("main-title")}</title>
        <meta name="description" content={t("app-description")} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* ログイン済みのみヘッダー表示 */}
      {isAuthenticated && (
        <header className={styles.header}>
          <div className={styles.headerContainer}>
            {isDocumentsPage && (
              <h1 className={styles.headerTitle}>{t("main-title")}</h1>
            )}
            
            {/* ドキュメント名を表示 */}
            {router.pathname === '/' && documentName && (
              <h2 className={styles.documentName} title={documentName}>
                {documentName}
              </h2>
            )}
            
            {/* ステージに応じた表示エリア (ドキュメント編集ページのみ) */}
            {router.pathname === '/' && fileId && (
              <div className={styles.stageIndicator}>
                {completionStage === 1 && <span>{t("Header.stage-description.thinking_process_self")}</span>}
                {completionStage === 2 && <span>{t("Header.stage-description.thinking_option_self")}</span>}
                {completionStage === 3 && <span>{t("Header.stage-description.thinking_option_llm")}</span>}
                {completionStage === 4 && <span>{t("Header.stage-description.thinking_deliberation_self")}</span>}
                {completionStage === 5 && <span>{t("Header.stage-description.thinking_deliberation_llm")}</span>}
                {completionStage === 6 && <span>{t("Header.stage-description.export")}</span>}
              </div>
            )}
            
            <div className={styles.headerActions}>
              {!isDocumentsPage && hasSoftDeletedLLM && (
                <button
                  onClick={handleRestoreLLMComment}
                  className={styles.backButton}
                  disabled={restoring}
                >
                  {restoring ? t("Header.restoring-llm-comments") : t("Header.restore-btn-ttl")}
                </button>
              )}
              {/* ドキュメント一覧に戻るボタン (documentsページ以外で表示) */}
              {!isDocumentsPage && (
                <button
                  onClick={handleBackToDocuments}
                  className={styles.backButton}
                >
                  <span>←</span>
                  <span>{t("Header.back-to-document-list")}</span>
                </button>
              )}

              {/* PDF倍率変更UI (documentsページ以外で表示) */}
              {!isDocumentsPage && (
                <div className={styles.scaleSelector}>
                  <label htmlFor="pdf-scale-select" className={styles.scaleLabel}>
                    {t("Scale")}:
                  </label>
                  <select
                    id="pdf-scale-select"
                    value={pdfScale.toString()}
                    onChange={handleScaleChange}
                    className={styles.scaleSelect}
                  >
                    {SCALE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ユーザー情報とログアウトボタン（ドキュメント一覧ページでのみ表示） */}
              {isDocumentsPage && (
                <div className={styles.userSection}>
                  {session?.user?.name && (
                    <span className={styles.userName}>{session.user.name}</span>
                  )}
                  <button
                    onClick={handleLogout}
                    className={styles.logoutButton}
                  >
                    {t("Logout.button-text")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <main className={`${styles.main} ${isAuthPage ? styles.authPage : ''}`}>
        <div className={`${styles.mainContainer} ${isAuthPage ? styles.authPage : ''}`}>
          {children}
        </div>
      </main>

      {/* ログイン済みのみフッター表示 */}
      {isAuthenticated && (
        <footer className={styles.footer}>
          <div className={styles.footerContainer}>
            <p className={styles.footerText}>
              <Trans
                i18nKey="footer-txt"
                values={{ year: new Date().getFullYear() }}
                components={{ year: <span>{new Date().getFullYear()}</span> }}
              />
            </p>
          </div>
        </footer>
      )}
    </>
  );
};

export default Layout;
