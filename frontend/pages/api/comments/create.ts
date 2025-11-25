import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const backendResponse = await fetch(`http://backend:8000/api/v1/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization ?? '',
      },
      body: JSON.stringify(req.body),
    });

    const data = await backendResponse.json();

    if (!backendResponse.ok) {
      return res.status(backendResponse.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Failed to proxy comment create:', error);
    return res.status(500).json({ message: 'Failed to reach backend' });
  }
}