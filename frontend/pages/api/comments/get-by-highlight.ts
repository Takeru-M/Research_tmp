import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { apiV1Client } from '@/utils/apiV1Client';
import { CommentEntity } from '@/types/Responses/Comment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions) as any;
  if (!session?.accessToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const highlightId = Number(req.query.highlight_id);
  if (!Number.isFinite(highlightId)) {
    return res.status(400).json({ message: 'Invalid highlight_id' });
  }

  try {
    const { data, error } = await apiV1Client<CommentEntity[]>(`/comments/highlight/${highlightId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (error || !data) {
      return res.status(400).json({ message: error || 'Failed to fetch comments' });
    }

    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e.message || 'Internal server error' });
  }
}