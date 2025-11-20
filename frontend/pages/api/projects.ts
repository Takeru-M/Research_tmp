import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

const BACKEND_URL = 'http://backend:8000/api/v1/projects/';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized (no access token)' });
  }

  const token = session.accessToken;

  if (req.method === 'GET') {
    try {
      const backendRes = await fetch(BACKEND_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!backendRes.ok) throw new Error(`Backend responded with ${backendRes.status}`);

      const data = await backendRes.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      return res.status(500).json({ error: 'プロジェクト一覧の取得に失敗しました' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { project_name, stage } = req.body;

      if (!project_name || stage === undefined) {
        return res.status(400).json({ error: '必須項目が不足しています' });
      }

      const backendRes = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ project_name, stage }),
      });

      if (!backendRes.ok) throw new Error(`Backend responded with ${backendRes.status}`);

      const data = await backendRes.json();
      return res.status(201).json(data);
    } catch (error) {
      console.error('Error creating project:', error);
      return res.status(500).json({ error: 'プロジェクト作成に失敗しました' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
