import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { setAccessToken } from '@/utils/apiClient';

/**
 * セッション変更時にアクセストークンを更新するカスタムフック
 * コンポーネントマウント時やセッション更新時にトークンをメモリに保存
 */
export function useAccessTokenSync() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.accessToken) {
      setAccessToken(session.accessToken);
      console.log('[useAccessTokenSync] Access token synced from session');
    } else {
      setAccessToken(null);
      console.log('[useAccessTokenSync] Access token cleared');
    }
  }, [session?.accessToken]);
}
