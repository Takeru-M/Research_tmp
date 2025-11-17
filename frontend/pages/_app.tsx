// src/pages/_app.tsx
import '../styles/globals.css';
import Layout from '../ components/Layout';
import { Provider } from 'react-redux';
import store from '../redux/store';
import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import "../lang/config";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <Provider store={store}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </Provider>
    </SessionProvider>
  );
}

export default MyApp;