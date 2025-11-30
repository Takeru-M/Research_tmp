import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;

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

    console.log('Request body:', req.body);

    if (!project_id || !file_name || !file_key) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
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

    // FastAPIのDB保存エンドポイントに送信
    const backendUrl = process.env.BACKEND_URL;
    const payload = {
      project_id: parseInt(project_id.toString(), 10), // 数値に変換
      file_name,
      file_key,
      file_url: file_url || null,
      mime_type: mime_type || 'application/pdf',
      file_size: file_size ? parseInt(file_size.toString(), 10) : null, // 数値に変換
    };

    console.log('Sending to FastAPI:', payload);

    const response = await fetch(`${BACKEND_URL}/project-files/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(payload),
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
        message: errorData.detail || 'Failed to save file to DB via FastAPI',
      });
    }

    const savedFile = await response.json();
    console.log('Saved file:', savedFile);

    return res.status(200).json({ success: true, savedFile });

  } catch (err: any) {
    console.error('Error saving file to DB:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
