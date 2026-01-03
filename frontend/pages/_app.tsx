import '../styles/globals.css';
import Layout from '../components/Layout';
import { Provider } from 'react-redux';
import store from '../redux/store';
import { SessionProvider, useSession } from 'next-auth/react';
import type { AppProps } from 'next/app';
import { useAccessTokenSync } from '../hooks/useAccessTokenSync';
import "../lang/config";

// アクセストークン同期コンポーネント
function AccessTokenSyncProvider({ children }: { children: React.ReactNode }) {
  useAccessTokenSync();
  return <>{children}</>;
}

function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session} refetchInterval={0}>
      <Provider store={store}>
        <AccessTokenSyncProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </AccessTokenSyncProvider>
      </Provider>
    </SessionProvider>
  );
}

export default MyApp;