import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { apiV1Client } from '@/utils/apiV1Client';
import { HighlightCreatePayload, HighlightEntity } from '@/types/Responses/Highlight';

type ApiError = { success: false; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HighlightEntity | ApiError>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions) as any;
    if (!session?.accessToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No access token' });
    }

    const {
      project_file_id,
      created_by,
      memo,
      text,
      rects,
      element_type
    } = req.body || {};

    if (
      project_file_id === undefined ||
      !created_by ||
      !memo ||
      !rects ||
      !Array.isArray(rects) ||
      rects.length === 0
    ) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const payload: HighlightCreatePayload = {
      project_file_id: parseInt(project_file_id.toString(), 10),
      created_by: String(created_by),
      memo: String(memo),
      text: text ? String(text) : null,
      rects: rects.map((r: any) => ({
        page_num: parseInt(r.page_num.toString(), 10),
        x1: parseFloat(r.x1.toString()),
        y1: parseFloat(r.y1.toString()),
        x2: parseFloat(r.x2.toString()),
        y2: parseFloat(r.y2.toString()),
      })),
      element_type: element_type ? String(element_type) : 'unknown',
    };

    const { data, error } = await apiV1Client<HighlightEntity>('/highlights', {
      method: 'POST',
      body: payload,
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (error || !data) {
      return res.status(400).json({ success: false, message: error || 'Failed to create highlight' });
    }

    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message || 'Internal server error' });
  }
}