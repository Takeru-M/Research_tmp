import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { comment_id } = req.body;

    if (!comment_id) {
      return res.status(400).json({ message: 'Comment ID is required' });
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const response = await fetch(`http://backend:8000/api/v1/comments/${comment_id}`, {
      method: 'DELETE',
      headers: {
        Authorization: req.headers.authorization ?? ''
      },
    });

    if (!response.ok) {
      // ステータスコード204の場合はエラーではない
      if (response.status === 204) {
        return res.status(200).json({ message: 'Comment deleted successfully' });
      }
      
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `Failed to delete comment: ${response.statusText}` };
      }
      return res.status(response.status).json(errorData);
    }

    return res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete comment:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}