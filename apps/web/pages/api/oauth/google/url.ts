import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const backendUrl = process.env.BACKEND_BASE_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/oauth/google/url`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch Google OAuth URL');
    }
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching Google OAuth URL:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
