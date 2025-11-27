import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
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
    // プロジェクト削除
    const response = await fetch(`http://backend:8000/api/v1/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
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
        message: errorData.detail || 'Failed to delete project via FastAPI',
      });
    }

    // 204 No Content の場合はボディが空なので、jsonを読まない
    if (response.status === 204) {
      console.log(`[API] Project ${projectId} deleted successfully`);
      return res.status(204).end();
    }

    // 他のステータスコードの場合はJSONを読む
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error(`[API] Error in /api/projects/${projectId}/delete:`, error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}