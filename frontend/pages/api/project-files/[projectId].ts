import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions) as any;

  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { projectId } = req.query;

  if (!projectId || Array.isArray(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const response = await fetch(
      `http://backend:8000/api/v1/project-files/project/${projectId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return res.status(response.status).json({
        error: errorData.detail || 'Failed to fetch project files',
      });
    }

    const files = await response.json();
    return res.status(200).json(files);

  } catch (error: any) {
    console.error('Error fetching project files:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}