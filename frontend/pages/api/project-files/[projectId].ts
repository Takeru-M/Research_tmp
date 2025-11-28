import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const BACKEND_URL = process.env.NEXT_PUBLIC_FASTAPI_URL;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { projectId } = req.query;

    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const session = await getServerSession(req, res, authOptions) as any;
    
    if (!session?.accessToken) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const response = await fetch(`${BACKEND_URL}/project-files/project/${projectId}/`, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    const files = await response.json();
    return res.status(200).json(files);

  } catch (error: any) {
    console.error('Error fetching project files:', error);
    return res.status(500).json({ message: error.message });
  }
}