import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './[...nextauth]';

// Exchange the NextAuth session (OAuth identity) for a backend token
// Expects backend to expose an endpoint that can mint a JWT based on OAuth user info
// Env: NEXT_PUBLIC_BACKEND_URL (e.g., http://localhost:3001)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions as any);
    if (!session || !session.user?.email) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

    // Construct payload for your backend to identify/create the user and mint a token
    const payload = {
      email: session.user.email,
      name: session.user.name || '',
      provider: (session.user as any).provider || 'oauth',
      // You can include provider account id if you add it to the session in callbacks
    };

    const resp = await fetch(`${backendBase}/api/v1/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: 'Backend exchange failed', details: text });
    }

    const data = await resp.json();
    // Expecting { accessToken: string, refreshToken: string }
    if (!data?.accessToken || !data?.refreshToken) {
      return res.status(500).json({ error: 'Backend did not return tokens' });
    }

    return res.status(200).json({ 
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    });
  } catch (err: any) {
    console.error('Error in /api/auth/exchange:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
