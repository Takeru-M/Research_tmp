import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

type Data = {
  success?: boolean;
  message?: string;
  id?: number;
  project_file_id?: number;
  created_by?: string;
  memo?: string;
  text?: string;
  created_at?: string;
  rects?: any[];
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
      project_file_id,
      created_by,
      memo,
      text,
      rects,
      element_type
    } = req.body;

    console.log('Request body:', req.body);

    // バリデーション
    if (!project_file_id || !created_by || !memo || !rects || !Array.isArray(rects)) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // セッション取得
    const session = await getServerSession(req, res, authOptions) as any;
    
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No session' });
    }
  
    if (!session?.accessToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No access token' });
    }

    // FastAPIのエンドポイントに送信
    const backendUrl = process.env.BACKEND_URL;
    const payload = {
      project_file_id: parseInt(project_file_id.toString(), 10),
      created_by,
      memo,
      text: text || null,
      rects: rects.map((rect: any) => ({
        page_num: parseInt(rect.page_num.toString(), 10),
        x1: parseFloat(rect.x1.toString()),
        y1: parseFloat(rect.y1.toString()),
        x2: parseFloat(rect.x2.toString()),
        y2: parseFloat(rect.y2.toString()),
      })),
      element_type: element_type || 'unknown',
    };

    console.log('Sending to FastAPI:', payload);

    const response = await fetch(`http://backend:8000/api/v1/highlights/`, {
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
        message: errorData.detail || 'Failed to create highlight',
      });
    }

    const savedHighlight = await response.json();
    console.log('Highlight saved:', savedHighlight);

    return res.status(200).json(savedHighlight);

  } catch (err: any) {
    console.error('Error creating highlight:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}