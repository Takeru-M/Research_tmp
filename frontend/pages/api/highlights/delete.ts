import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { highlight_id } = req.body;

    if (!highlight_id) {
      return res.status(400).json({ message: 'Highlight ID is required' });
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const response = await fetch(`http://backend:8000/api/v1/highlights/${highlight_id}`, {
      method: 'DELETE',
      headers: {
        Authorization: req.headers.authorization ?? ''
      },
    });

    if (!response.ok) {
      // ステータスコード204の場合はエラーではない
      if (response.status === 204) {
        return res.status(200).json({ message: 'Highlight deleted successfully' });
      }
      
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `Failed to delete highlight: ${response.statusText}` };
      }
      return res.status(response.status).json(errorData);
    }

    return res.status(200).json({ message: 'Highlight deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete highlight:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}