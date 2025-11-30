import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;

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
    // PUT: コメント更新
    if (req.method === 'PUT') {
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({ message: 'Text is required' });
      }

      const response = await fetch(`${BACKEND_URL}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    // DELETE: コメント削除
    if (req.method === 'DELETE') {
      const response = await fetch(`${BACKEND_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // 204 No Content の場合
      if (response.status === 204) {
        return res.status(200).json({ message: 'Comment deleted successfully' });
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `Failed to delete comment: ${response.statusText}` };
        }
        return res.status(response.status).json(errorData);
      }

      return res.status(200).json({ message: 'Comment deleted successfully' });
    }

    // それ以外のメソッド
    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({ message: 'Method not allowed' });

  } catch (error: any) {
    console.error('Failed to process comment request:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}