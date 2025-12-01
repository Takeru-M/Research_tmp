import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { apiV1Client } from '@/utils/apiV1Client';
import { ProjectEntity } from '@/types/Responses/Project';
import { ProjectCreateRequest } from '@/types/Requests/Project';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any) as any;

  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized (no access token)' });
  }

  const token = session.accessToken;

  if (req.method === 'GET') {
    try {
      const { data, error } = await apiV1Client<ProjectEntity[]>('/projects/', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || !data) {
        return res.status(500).json({ error: error || 'プロジェクト一覧の取得に失敗しました' });
      }

      return res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      return res.status(500).json({ error: 'プロジェクト一覧の取得に失敗しました' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { project_name, stage } = req.body as ProjectCreateRequest;

      if (!project_name || stage === undefined) {
        return res.status(400).json({ error: '必須項目が不足しています' });
      }

      const { data, error } = await apiV1Client<ProjectEntity>('/projects/', {
        method: 'POST',
        body: { project_name, stage },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error || !data) {
        return res.status(500).json({ error: error || 'プロジェクト作成に失敗しました' });
      }

      return res.status(201).json(data);
    } catch (error) {
      console.error('Error creating project:', error);
      return res.status(500).json({ error: 'プロジェクト作成に失敗しました' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
