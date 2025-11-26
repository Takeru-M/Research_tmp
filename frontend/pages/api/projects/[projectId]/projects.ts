import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ||
  'http://localhost:8000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { projectId } = req.query;

  if (!projectId || Array.isArray(projectId)) {
    res.status(400).json({ message: 'Invalid projectId' });
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    // FastAPI側の想定エンドポイント例: /projects/{project_id}
    const backendUrl = process.env.BACKEND_URL;

    // セッション取得
    const session = await getServerSession(req, res, authOptions) as any;
    
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No session' });
    }
  
    if (!session?.accessToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No access token' });
    }

    const backendRes = await fetch(`http://backend:8000/api/v1/projects/${projectId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    if (!backendRes.ok) {
      const text = await backendRes.text();
      console.error('Backend error:', backendRes.status, text);
      res
        .status(backendRes.status)
        .json({ message: 'Failed to fetch project info', detail: text });
      return;
    }

    const data = await backendRes.json();

    // stage/completion_stage 正規化
    const stageRaw = data?.completion_stage ?? data?.stage ?? null;
    const stage =
      stageRaw === null || Number.isNaN(Number(stageRaw))
        ? null
        : Number(stageRaw);

    res.status(200).json({
      ...data,
      stage, // 正規化済み
      completion_stage: stage, // 両方参照できるように
    });
  } catch (e: any) {
    console.error('API route error:', e);
    res.status(500).json({ message: 'Internal Server Error', detail: e.message });
  }
}