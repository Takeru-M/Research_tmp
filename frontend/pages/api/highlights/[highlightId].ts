import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;

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
      const { highlight_id } = req.query;

      if (!highlight_id) {
        return res.status(400).json({ message: 'Highlight ID is required' });
      }

      const response = await fetch(`${BACKEND_URL}/highlights/${highlight_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`
        },
      });

      if (!response.ok) {
        // ステータスコード204の場合はエラーではない
        if (response.status === 204) {
          return res.status(200).json({ message: 'Highlight deleted successfully' });
        }
        
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `Failed to delete highlight: ${response.statusText}` };
        }
        return res.status(response.status).json(errorData);
      }

      return res.status(200).json({ message: 'Highlight deleted successfully' });
    } catch (error: any) {
      console.error('Failed to delete highlight:', error);
      return res.status(500).json({ message: error.message || 'Internal server error' });
    }
  }
}