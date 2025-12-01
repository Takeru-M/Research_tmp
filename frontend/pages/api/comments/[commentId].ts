import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { apiV1Client } from '@/utils/apiV1Client';
import { CommentEntity, CommentDeleteResponse } from '@/types/Responses/Comment';
import { CommentUpdateRequest } from '@/types/Requests/Comment';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { commentId } = req.query;

  if (!commentId || Array.isArray(commentId)) {
    return res.status(400).json({ message: 'Invalid comment ID' });
  }

  const session = await getServerSession(req, res, authOptions) as any;
  if (!session?.accessToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = session.accessToken;

  try {
    // 更新
    if (req.method === 'PUT') {
      const { text } = req.body as CommentUpdateRequest;
      if (!text) {
        return res.status(400).json({ message: 'Text is required' });
      }

      const { data, error } = await apiV1Client<CommentEntity>(`/comments/${commentId}`, {
        method: 'PUT',
        body: { text },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || !data) {
        return res.status(400).json({ message: error || 'Failed to update comment' });
      }
      return res.status(200).json(data);
    }

    // 削除
    if (req.method === 'DELETE') {
      const { data, error } = await apiV1Client<CommentDeleteResponse>(`/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        return res.status(400).json({ message: error || 'Failed to delete comment' });
      }

      // 204相当の場合 data は null の可能性
      return res.status(200).json(data || { message: 'Comment deleted successfully' });
    }

    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e: any) {
    console.error('Failed to process comment request:', e);
    return res.status(500).json({ message: e.message || 'Internal server error' });
  }
}