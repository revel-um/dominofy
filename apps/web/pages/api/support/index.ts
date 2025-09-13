import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'anon';
    if (req.method === 'GET') {
      const r = await fetch(${BACKEND_URL}/support/my, {
        headers: { 'x-user-id': userId, 'content-type': 'application/json' },
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }
    if (req.method === 'POST') {
      const r = await fetch(${BACKEND_URL}/support, {
        method: 'POST',
        headers: { 'x-user-id': userId, 'content-type': 'application/json' },
        body: JSON.stringify(req.body || {}),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (e: any) {
    return res.status(500).json({ message: 'Proxy error', error: e?.message || String(e) });
  }
}
