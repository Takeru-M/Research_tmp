import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { apiV1Client } from '@/utils/apiV1Client';
import { UpdateCompletionStageRequest, UpdateCompletionStageResponse } from '@/types/Responses/Project';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { projectId } = req.query;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ message: 'Project ID is required' });
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const session = await getServerSession(req, res, authOptions) as any;
  
  if (!session?.accessToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    console.log(`[PATCH /api/projects/${projectId}/update-completion-stage] Updating completion stage:`, req.body);

    const { data, error } = await apiV1Client<UpdateCompletionStageResponse>(
      `/projects/${projectId}/update-completion-stage`,
      {
        method: 'PATCH',
        body: req.body as UpdateCompletionStageRequest,
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (error || !data) {
      console.error('Backend error response:', error);
      return res.status(400).json({
        message: error || 'Failed to update completion stage',
      });
    }

    console.log('Completion stage updated successfully:', data);
    return res.status(200).json(data);
  } catch (error) {
    console.error(`Failed to update completion stage for project ${projectId}:`, error);
    return res.status(500).json({
      message: 'Failed to reach backend',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}