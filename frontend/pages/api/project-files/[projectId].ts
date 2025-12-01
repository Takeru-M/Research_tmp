import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { apiV1Client } from '@/utils/apiV1Client';
import { ProjectFile } from '@/types/Responses/ProjectFile';

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

    const { data, error } = await apiV1Client<ProjectFile[]>(`/project-files/project/${projectId}/`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (error || !data) {
      return res.status(400).json({ message: error || 'Failed to fetch project files' });
    }

    return res.status(200).json(data);

  } catch (error: any) {
    console.error('Error fetching project files:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}