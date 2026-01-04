import React from 'react';
import { buildAuthHeaders, getUserIdFromSession, getDocumentIdFromSession } from '../utils/authHelpers';
import type { Session } from 'next-auth';

/**
 * 認証関連のヘッダーとセッション値を取得するカスタムフック
 */
export const useAuthInfo = (session: Session | null | undefined) => {
  const authHeaders = React.useMemo(
    () => buildAuthHeaders(session?.accessToken),
    [session?.accessToken]
  );

  const getUserId = React.useCallback(
    () => getUserIdFromSession(session),
    [session]
  );

  const getDocumentId = React.useCallback(
    () => getDocumentIdFromSession(session),
    [session]
  );

  return {
    authHeaders,
    getUserId,
    getDocumentId,
  };
};
