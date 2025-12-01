import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { apiV1Client } from '@/utils/apiV1Client';
import { SaveFileRequest, SavedFileResponse } from '@/types/Responses/ProjectFile';

type Data = {
  success: boolean;
  message?: string;
  savedFile?: SavedFileResponse;
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

    const payload: SaveFileRequest = {
      project_id: parseInt(project_id.toString(), 10),
      file_name,
      file_key,
      file_url: file_url || null,
      mime_type: mime_type || 'application/pdf',
      file_size: file_size ? parseInt(file_size.toString(), 10) : null,
    };

    console.log('Sending to FastAPI:', payload);

    const { data, error } = await apiV1Client<SavedFileResponse>('/project-files/', {
      method: 'POST',
      body: payload,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (error || !data) {
      console.error('FastAPI error response:', error);
      return res.status(400).json({
        success: false,
        message: error || 'Failed to save file to DB via FastAPI',
      });
    }

    console.log('Saved file:', data);

    return res.status(200).json({ success: true, savedFile: data });

  } catch (err: any) {
    console.error('Error saving file to DB:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
