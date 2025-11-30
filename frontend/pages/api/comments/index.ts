import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  const session = await getServerSession(req, res, authOptions) as any;
  
  if (!session?.accessToken) {
    console.error('[Comment Create] No access token found in session');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    try {
    console.log('[Comment Create] Request body:', JSON.stringify(req.body, null, 2));
    
    const backendResponse = await fetch(`${BACKEND_URL}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(req.body),
    });

    console.log('[Comment Create] Backend response status:', backendResponse.status);

    const contentType = backendResponse.headers.get('content-type');
    
    if (!contentType?.includes('application/json')) {
      const text = await backendResponse.text();
      console.error('[Comment Create] Non-JSON response from backend:', text);
      return res.status(502).json({ 
        message: 'Backend returned non-JSON response',
        details: text.substring(0, 500), // 長すぎる場合は切り詰める
        status: backendResponse.status
      });
    }

    const data = await backendResponse.json();

    if (!backendResponse.ok) {
      console.error('[Comment Create] Backend error:', data);
      return res.status(backendResponse.status).json({
        message: data.detail || data.message || 'Failed to create comment',
        ...data
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[Comment Create] Exception occurred:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
  }
}