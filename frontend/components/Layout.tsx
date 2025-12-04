// src/components/Layout.tsx
import Head from 'next/head';
import React, { ChangeEvent, PropsWithChildren, useCallback, useEffect } from 'react';
import styles from '../styles/Layout.module.css';
import { Trans, useTranslation } from "react-i18next";
import { useSelector, useDispatch } from 'react-redux';
import { useSession, signOut, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { RootState } from '@/redux/rootReducer';
import { setPdfScale } from '../redux/features/editor/editorSlice';
import { SCALE_OPTIONS } from '@/utils/constants';

const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const pdfScale = useSelector((state: RootState) => state.editor.pdfScale);
  const documentName = useSelector((state: RootState) => state.editor.documentName);


  const isAuthPage = ['/login', '/signup'].includes(router.pathname);
  const isProjectsPage = router.pathname === '/projects';

  const handleScaleChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const newScale = parseFloat(event.target.value);
    dispatch(setPdfScale(newScale));
  }, [dispatch]);

  const handleLogout = useCallback(() => {
    signOut({ callbackUrl: '/login' });
  }, []);

  const handleBackToProjects = useCallback(() => {
    router.push('/projects');
  }, [router]);

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
            <h1 className={styles.headerTitle}>{t("main-title")}</h1>
            
            {/* プロジェクト名を表示 */}
            {router.pathname === '/' && documentName && (
              <h2 className={styles.documentName}>
                {documentName}
              </h2>
            )}
            
            <div className={styles.headerActions}>
              {/* プロジェクト一覧に戻るボタン (projectsページ以外で表示) */}
              {!isProjectsPage && (
                <button
                  onClick={handleBackToProjects}
                  className={styles.backButton}
                >
                  <span>←</span>
                  <span>{t("header.back-to-document-list")}</span>
                </button>
              )}

              {/* PDF倍率変更UI (projectsページ以外で表示) */}
              {!isProjectsPage && (
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

              {/* ユーザー情報とログアウトボタン */}
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
