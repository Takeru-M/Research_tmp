import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // セッション取得
  const session = await getServerSession(req, res, authOptions) as any;
  
  console.log('Session:', session);
  console.log('Access Token:', session?.accessToken);
  
  if (!session?.user?.email) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No session' });
  }

  if (!session?.accessToken) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No access token' });
  }

  try {
    const { project_id, stage } = req.body;

    if (!project_id || stage === undefined) {
      return res.status(400).json({ message: 'Project ID and stage are required' });
    }

    const response = await fetch(`${BACKEND_URL}/projects/stage/${project_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ stage }),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `Failed to update project stage: ${response.statusText}` };
      }
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Failed to update project stage:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}