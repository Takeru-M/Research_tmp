// src/components/Layout.tsx
import Head from 'next/head';
import React, { ChangeEvent, PropsWithChildren, useCallback } from 'react';
import styles from '../styles/Home.module.css';
import { Trans, useTranslation } from "react-i18next";
import { useSelector, useDispatch } from 'react-redux';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { RootState } from '@/redux/rootReducer';
import { setPdfScale } from '../redux/features/editor/editorSlice';
import { SCALE_OPTIONS } from '@/utils/constants';
import { logout } from '../redux/features/auth/authSlice';

const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const pdfScale = useSelector((state: RootState) => state.editor.pdfScale);
  const router = useRouter();
  const isLoginPage = router.pathname === '/login';

  const handleScaleChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const newScale = parseFloat(event.target.value);
    dispatch(setPdfScale(newScale));
  }, [dispatch]);

  const handleLogout = useCallback(() => {
    signOut({ callbackUrl: '/login' });
  }, []);

  const headerContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  };

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

      {/* ログイン時のみヘッダーを表示 */}
      {isAuthenticated && (
        <header className={styles.header || 'header'}>
          <div className={styles.container || 'container'} style={headerContainerStyle}>
            <h1>{t("main-title")}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* 倍率変更 UI */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label htmlFor="pdf-scale-select">{t("Scale")}:</label>
                <select
                  id="pdf-scale-select"
                  value={pdfScale.toString()}
                  onChange={handleScaleChange}
                  style={{ padding: '5px', minWidth: '80px' }}
                >
                  {SCALE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {/* ユーザー情報とログアウトボタン */}
              {/* TODO: CSSを別ファイルに */}
              {session?.user?.name && <span style={{ marginRight: '10px' }}>{session.user.name}</span>}
              <button
                onClick={handleLogout}
                style={{
                  padding: '6px 14px',
                  cursor: 'pointer',
                  backgroundColor: '#f1f3f5',
                  border: '1px solid #d0d7de',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  color: '#333',
                  transition: 'background-color 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e9ecef';
                  e.currentTarget.style.borderColor = '#c1c8ce';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f3f5';
                  e.currentTarget.style.borderColor = '#d0d7de';
                }}
              >
                {t("Logout.button-text")}
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={styles.main || 'main-content'}>
        {isLoginPage ? (
          <div>{children}</div>
        ) : (
          <div className={styles.container || 'container'}>{children}</div>
        )}
      </main>

      {/* ログイン時のみフッターを表示 */}
      {isAuthenticated && (
        <footer className={styles.footer || 'footer'}>
          <div className={styles.container || 'container'}>
            <p>
            <Trans
              i18nKey="footer-txt"
              values={{
                year: new Date().getFullYear(),
              }}
              components={{
                year: <>{new Date().getFullYear()}</>
              }}
            />
            </p>
          </div>
        </footer>
      )}
    </>
  );
};

export default Layout;