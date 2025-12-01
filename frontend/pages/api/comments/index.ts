import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { apiV1Client } from '@/utils/apiV1Client';
import { CommentCreateRequest, CommentEntity } from '@/types/Responses/Comment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions) as any;

  if (!session?.accessToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    try {
      const body: CommentCreateRequest = req.body;
      if (!body?.text || !Number.isFinite(body?.highlight_id)) {
        return res.status(400).json({ message: 'Invalid request body' });
      }

      const { data, error } = await apiV1Client<CommentEntity>('/comments', {
        method: 'POST',
        body,
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });

      if (error || !data) {
        return res.status(400).json({ message: error || 'Failed to create comment' });
      }

      return res.status(200).json(data);
    } catch (e: any) {
      return res.status(500).json({ message: e.message || 'Internal server error' });
    }
  }

  res.setHeader('Allow', ['POST']);
  return res.status(405).json({ message: 'Method not allowed' });
}