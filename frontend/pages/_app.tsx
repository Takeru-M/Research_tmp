import '../styles/globals.css';
import Layout from '../components/Layout';
import { Provider } from 'react-redux';
import store from '../redux/store';
import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import "../lang/config";

function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session} refetchInterval={0}>
      <Provider store={store}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </Provider>
    </SessionProvider>
  );
}

export default MyApp;