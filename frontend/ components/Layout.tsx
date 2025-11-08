// src/components/Layout.tsx
import Head from 'next/head';
import React, { PropsWithChildren } from 'react';
import styles from '../styles/Home.module.css';
import { Trans, useTranslation } from "react-i18next";

const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation();

  return (
    <>
      <Head>
        <title>{t("main-title")}</title>
        <meta name="description" content={t("app-description")} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header || 'header'}>
        <div className={styles.container || 'container'}>
          <h1>{t("main-title")}</h1>
        </div>
      </header>

      <main className={styles.main || 'main-content'}>
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