import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { apiV1Client } from '@/utils/apiV1Client';
import { HighlightDeleteResponse } from '@/types/Responses/Highlight';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions) as any;

  if (!session?.accessToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method === 'DELETE') {
    try {
      const { highlightId } = req.query;
      if (!highlightId || Array.isArray(highlightId)) {
        return res.status(400).json({ message: 'Highlight ID is required' });
      }

      const { data, error } = await apiV1Client<HighlightDeleteResponse | null>(`/highlights/${highlightId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });

      if (error) {
        return res.status(400).json({ message: error });
      }

      return res.status(200).json(data || { message: 'Highlight deleted successfully' });
    } catch (e: any) {
      console.error('Failed to delete highlight:', e);
      return res.status(500).json({ message: e.message || 'Internal server error' });
    }
  }

  res.setHeader('Allow', ['DELETE']);
  return res.status(405).json({ message: 'Method not allowed' });
}