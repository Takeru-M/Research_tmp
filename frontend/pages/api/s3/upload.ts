// pages/api/pdf/upload.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import formidable from 'formidable';
import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';
import path from 'path';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // セッション取得
  const session = await getServerSession(req, res, authOptions) as any;
  
  console.log('Session:', session);
  console.log('Access Token:', session?.accessToken);
  
  if (!session?.user?.email) {
    return res.status(401).json({ message: 'Unauthorized: No session' });
  }

  if (!session?.accessToken) {
    return res.status(401).json({ message: 'Unauthorized: No access token' });
  }

  const uploadDir = path.join(process.cwd(), 'tmp_uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({
    multiples: false,
    keepExtensions: true,
    uploadDir,
    filename: (name, ext, part) => {
      return `${Date.now()}_${part.originalFilename || 'upload'}${ext}`;
    },
  });

  try {
    const [fields, files] = await form.parse(req);

    const fileArray = Array.isArray(files.file) ? files.file : [files.file];
    const file = fileArray[0];

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filepath = file.filepath;
    const filename = file.originalFilename || file.newFilename || 'uploaded.pdf';

    if (!filepath || !fs.existsSync(filepath)) {
      console.error('File not found at path:', filepath);
      console.error('File object:', file);
      return res.status(500).json({
        message: 'File path is undefined or file does not exist',
        filepath,
        fileExists: filepath ? fs.existsSync(filepath) : false,
      });
    }

    console.log('Uploading file:', { filepath, filename, size: file.size });
    console.log('Authorization token (first 20 chars):', session.accessToken.substring(0, 20) + '...');

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filepath), filename);

    const fastApiResponse = await axios.post(
      'http://backend:8000/api/v1/s3/upload',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${session.accessToken}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    // 送信後、Tempファイル削除
    try {
      fs.unlinkSync(filepath);
    } catch (unlinkError) {
      console.error('Failed to delete temp file:', unlinkError);
    }

    return res.status(200).json(fastApiResponse.data);
  } catch (error: any) {
    console.error('Upload error details:', {
      message: error.message,
      response: error?.response?.data,
      status: error?.response?.status,
    });
    return res.status(500).json({
      message: 'Upload failed',
      error: error?.response?.data || error.message,
    });
  }
}
