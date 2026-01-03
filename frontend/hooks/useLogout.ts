import { signOut } from 'next-auth/react';
import { setAccessToken, getAccessToken } from '@/utils/apiClient';
import { useRouter } from 'next/router';

/**
 * ログアウト機能を提供するカスタムフック
 */
export function useLogout() {
  const router = useRouter();

  const logout = async () => {
    try {
      console.log('[useLogout] Starting logout process...');

      // 1. アクセストークンをメモリからクリア（ただし、バックエンド呼び出し前に取得）
      const accessToken = getAccessToken();
      console.log('[useLogout] Access token state:', accessToken ? 'exists' : 'null');

      // 2. バックエンドのログアウトエンドポイントを呼び出し
      // リフレッシュトークンクッキーが削除される
      const baseUrl = process.env.NEXT_PUBLIC_API_URL_LOCAL;
      console.log('[useLogout] Base URL:', baseUrl);
      
      if (baseUrl && accessToken) {
        try {
          const response = await fetch(`${baseUrl}/auth/logout/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            credentials: 'include', // クッキー送信
          });
          
          if (!response.ok) {
            console.warn(`[useLogout] Backend logout returned status ${response.status}`);
          } else {
            console.log('[useLogout] Backend logout completed');
          }
        } catch (error) {
          console.error('[useLogout] Backend logout failed:', {
            error,
            baseUrl,
            message: error instanceof Error ? error.message : String(error),
          });
          // バックエンドエラーでも処理を続行
        }
      } else {
        console.warn('[useLogout] Missing baseUrl or accessToken', {
          hasBaseUrl: !!baseUrl,
          hasAccessToken: !!accessToken,
        });
      }

      // 3. アクセストークンをメモリからクリア
      setAccessToken(null);
      console.log('[useLogout] Access token cleared from memory');

      // 4. NextAuth のセッションをクリア
      await signOut({ redirect: false });
      console.log('[useLogout] NextAuth session cleared');

      // 5. ログインページへリダイレクト
      await router.push('/login');
    } catch (error) {
      console.error('[useLogout] Unexpected error during logout:', error);
      // エラーが発生してもログインページへリダイレクト
      window.location.href = '/login';
    }
  };

  return { logout };
}
