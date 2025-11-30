import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { projectId } = req.query;

  if (!projectId || Array.isArray(projectId)) {
    res.status(400).json({ message: 'Invalid projectId' });
    return;
  }

  // セッション取得
  const session = await getServerSession(req, res, authOptions) as any;
  
  if (!session?.user?.email) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No session' });
  }

  if (!session?.accessToken) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No access token' });
  }

  const token = session.accessToken;

  // GET: プロジェクト情報取得
  if (req.method === 'GET') {
    try {
      const backendRes = await fetch(`${BACKEND_URL}/projects/${projectId}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
    return;
  }

  // PUT: プロジェクト更新
  if (req.method === 'PUT') {
    try {
      const response = await fetch(`${BACKEND_URL}/projects/${projectId}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(req.body),
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
          message: errorData.detail || 'Failed to update project via FastAPI',
        });
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (error: any) {
      console.error(`[API] Error updating project ${projectId}:`, error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }

  // DELETE: プロジェクト削除
  if (req.method === 'DELETE') {
    try {
      const response = await fetch(`${BACKEND_URL}/projects/${projectId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      console.error(`[API] Error deleting project ${projectId}:`, error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }

  // それ以外のメソッド
  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  res.status(405).json({ message: 'Method Not Allowed' });
}