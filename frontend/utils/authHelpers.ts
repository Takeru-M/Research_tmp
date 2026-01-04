import type { Session } from 'next-auth';

/**
 * セッションからユーザーIDを取得する
 */
export const getUserIdFromSession = (session: Session | null | undefined): string => {
  return (session as any)?.user?.id || (session as any)?.user?.email || 'anonymous';
};

/**
 * セッションからドキュメントIDを取得する
 */
export const getDocumentIdFromSession = (session: Session | null | undefined): number | null => {
  const docId = (session as any)?.preferredDocumentId ?? (session as any)?.user?.preferredDocumentId ?? null;
  if (docId === null || docId === undefined) return null;
  const n = Number(docId);
  return Number.isNaN(n) ? null : n;
};

/**
 * セッションからアクセストークンを取得してAuthorizationヘッダーを構築
 */
export const buildAuthHeaders = (accessToken: string | undefined): { Authorization: string } | undefined => {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
};
