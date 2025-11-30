import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions) as any;
  if (!session?.accessToken) return res.status(401).json({ message: 'Unauthorized' });

  const highlightId = Number(req.query.highlight_id);
  if (!Number.isFinite(highlightId)) return res.status(400).json({ message: 'Invalid highlight_id' });

  try {
    const resp = await fetch(`${BACKEND_URL}/comments/highlight/${highlightId}`, {
      headers: { 'Authorization': `Bearer ${session.accessToken}` },
    });
    if (!resp.ok) {
      let err = {};
      try { err = await resp.json(); } catch {}
      return res.status(resp.status).json(err);
    }
    const data = await resp.json();
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e.message || 'Internal server error' });
  }
}