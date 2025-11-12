// src/components/Layout.tsx
import Head from 'next/head';
import React, { ChangeEvent, PropsWithChildren, useCallback } from 'react';
import styles from '../styles/Home.module.css';
import { Trans, useTranslation } from "react-i18next";
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/redux/rootReducer';
import { setPdfScale } from '../redux/features/editor/editorSlice';
import { SCALE_OPTIONS } from '@/utils/constants';

const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const pdfScale = useSelector((state: RootState) => state.editor.pdfScale);

  const handleScaleChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const newScale = parseFloat(event.target.value);
    dispatch(setPdfScale(newScale));
  }, [dispatch]);

  return (
    <>
      <Head>
        <title>{t("main-title")}</title>
        <meta name="description" content={t("app-description")} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header || 'header'} style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#fff', borderBottom: '1px solid #ccc' }}>
        <div className={styles.container || 'container'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>{t("main-title")}</h1>
          {/* 倍率変更 UI の追加 */}
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
        </div>
      </header>

      <main className={styles.main || 'main-content'} style={{ paddingTop: '70px' }}>
        <div className={styles.container || 'container'}>{children}</div>
      </main>

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
    </>
  );
};

export default Layout;