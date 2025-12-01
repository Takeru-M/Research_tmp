import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { apiV1Client } from '@/utils/apiV1Client';
import { ProjectResponse, ProjectUpdateRequest } from '@/types/Responses/Project';

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
      const { data, error } = await apiV1Client<ProjectResponse>(`/projects/${projectId}/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error || !data) {
        console.error('Backend error:', error);
        return res.status(400).json({ message: 'Failed to fetch project info', detail: error });
      }

      // stage/completion_stage 正規化
      const stageRaw = data?.completion_stage ?? data?.stage ?? null;
      const stage =
        stageRaw === null || Number.isNaN(Number(stageRaw))
          ? null
          : Number(stageRaw);

      return res.status(200).json({
        ...data,
        stage, // 正規化済み
        completion_stage: stage, // 両方参照できるように
      });
    } catch (e: any) {
      console.error('API route error:', e);
      return res.status(500).json({ message: 'Internal Server Error', detail: e.message });
    }
  }

  // PUT: プロジェクト更新
  if (req.method === 'PUT') {
    try {
      const { data, error } = await apiV1Client<ProjectResponse>(`/projects/${projectId}/`, {
        method: 'PUT',
        body: req.body as ProjectUpdateRequest,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error || !data) {
        console.error('FastAPI error response:', error);
        return res.status(400).json({
          success: false,
          message: error || 'Failed to update project via FastAPI',
        });
      }

      return res.status(200).json(data);
    } catch (error: any) {
      console.error(`[API] Error updating project ${projectId}:`, error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }

  // DELETE: プロジェクト削除
  if (req.method === 'DELETE') {
    try {
      const { data, error } = await apiV1Client<{ message: string } | null>(`/projects/${projectId}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error) {
        console.error('FastAPI error response:', error);
        return res.status(400).json({
          success: false,
          message: error || 'Failed to delete project via FastAPI',
        });
      }

      console.log(`[API] Project ${projectId} deleted successfully`);
      // 204相当の場合は data が null の可能性
      return res.status(200).json(data || { message: 'Project deleted successfully' });
    } catch (error: any) {
      console.error(`[API] Error deleting project ${projectId}:`, error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }

  // それ以外のメソッド
  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  res.status(405).json({ message: 'Method Not Allowed' });
}