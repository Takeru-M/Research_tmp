import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { projectId, fileId } = req.query as { projectId?: string; fileId?: string };
    console.log(`[Export][NextAPI] start at=${new Date().toISOString()} projectId=${projectId} fileId=${fileId}`);

    if (!projectId || !fileId) {
      console.error('[Export][NextAPI] Missing query params');
      return res.status(400).json({ message: 'projectId and fileId are required' });
    }

    const session = await getServerSession(req, res, authOptions) as any;
    console.log('[Export][NextAPI] Session user:', session?.user?.email);
    console.log('[Export][NextAPI] Access Token present:', !!session?.accessToken);

    if (!session?.user?.email) {
      console.error('[Export][NextAPI] Unauthorized: No session');
      return res.status(401).json({ success: false, message: 'Unauthorized: No session' });
    }
    if (!session?.accessToken) {
      console.error('[Export][NextAPI] Unauthorized: No access token');
      return res.status(401).json({ success: false, message: 'Unauthorized: No access token' });
    }

    const baseUrl = process.env.BACKEND_BASE_URL;
    const backendUrl = `http://backend:8000/api/v1/projects/${projectId}/files/${fileId}/export`;
    console.log('[Export][NextAPI] Fetching backend URL:', backendUrl);

    const backendRes = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    console.log('[Export][NextAPI] Backend response ok:', backendRes.ok, 'status:', backendRes.status);
    const hdrs: Record<string, string> = {};
    backendRes.headers.forEach((v, k) => (hdrs[k] = v));
    console.log('[Export][NextAPI] Backend headers:', hdrs);

    if (!backendRes.ok) {
      const detail = await backendRes.text().catch(() => '');
      console.error('[Export][NextAPI] Backend export failed body:', detail);
      return res.status(backendRes.status).json({ message: 'Backend export failed', detail });
    }

    const arrayBuffer = await backendRes.arrayBuffer();
    console.log('[Export][NextAPI] Received bytes:', arrayBuffer.byteLength);

    const contentDisposition = backendRes.headers.get('content-disposition') ?? 'attachment; filename="export.pdf"';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('Content-Length', String(arrayBuffer.byteLength));
    console.log('[Export][NextAPI] Responding to client with PDF');
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (e) {
    console.error('[Export][NextAPI] Internal error:', e);
    return res.status(500).json({ message: 'Internal error' });
  }
}