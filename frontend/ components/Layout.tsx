// src/components/Layout.tsx
import Head from 'next/head';
import React, { PropsWithChildren } from 'react';
import styles from '../styles/Home.module.css';

const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <>
      <Head>
        <title>ファイルエディタ</title>
        <meta name="description" content="ファイルエディタアプリケーション" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header || 'header'}>
        <div className={styles.container || 'container'}>
          <h1>ファイルエディタ</h1>
        </div>
      </header>

      <main className={styles.main || 'main-content'}>
        <div className={styles.container || 'container'}>{children}</div>
      </main>

      <footer className={styles.footer || 'footer'}>
        <div className={styles.container || 'container'}>
          <p>&copy; {new Date().getFullYear()} My File Editor</p>
        </div>
      </footer>
    </>
  );
};

export default Layout;