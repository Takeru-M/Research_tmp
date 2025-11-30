import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;

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

    const backendResponse = await fetch(`${BACKEND_URL}/projects/${projectId}/update-completion-stage`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(req.body),
    });

    const contentType = backendResponse.headers.get('content-type');
    console.log('Backend response status:', backendResponse.status);
    console.log('Backend response content-type:', contentType);

    if (!contentType?.includes('application/json')) {
      const text = await backendResponse.text();
      console.error('Non-JSON response from backend:', text);
      return res.status(backendResponse.status).json({
        message: 'Backend returned non-JSON response',
        details: text,
      });
    }

    const data = await backendResponse.json();

    if (!backendResponse.ok) {
      console.error('Backend error response:', data);
      return res.status(backendResponse.status).json(data);
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