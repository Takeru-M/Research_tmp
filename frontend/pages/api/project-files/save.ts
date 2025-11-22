import type { NextApiRequest, NextApiResponse } from 'next';

type Data = {
  success: boolean;
  message?: string;
  savedFile?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const {
      project_id,
      file_name,
      file_key,
      file_url,
      mime_type,
      file_size,
    } = req.body;

    if (!project_id || !file_name || !file_key) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // FastAPIのDB保存エンドポイントに送信
    const response = await fetch('http://backend:8000/api/v1/project-files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id,
        file_name,
        file_key,
        file_url,
        mime_type,
        file_size,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        success: false,
        message: errorData.detail || 'Failed to save PDF to DB via FastAPI',
      });
    }

    const savedFile = await response.json();

    return res.status(200).json({ success: true, savedFile });

  } catch (err: any) {
    console.error('Error saving PDF to DB:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
