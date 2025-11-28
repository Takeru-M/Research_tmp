import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

const BACKEND_URL = process.env.NEXT_PUBLIC_FASTAPI_URL;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  if (!session || !session.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { projectId } = req.query;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    // プロジェクト更新
      const response = await fetch(`${BACKEND_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FastAPI error response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText };
        }

        return res.status(response.status).json({
          success: false,
          message: errorData.detail || 'Failed to update project via FastAPI',
        });
      }

      const data = await response.json();
      return res.status(200).json(data);
  } catch (error: any) {
    console.error(`[API] Error in /api/v1/projects/${projectId}:`, error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}