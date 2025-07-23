import type { NextApiRequest, NextApiResponse } from 'next';
import { testConnection, ConnectionConfig } from '@/lib/db';

type ResponseData = {
  connected: boolean;
  error?: string;
};

// Add CORS headers
const allowCors = (fn: Function) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-V, Authorization'
  );
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  return await fn(req, res);
};

// API endpoint to test a database connection
export default allowCors(async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      connected: false,
      error: 'Method not allowed' 
    });
  }

  const { connectionConfig } = req.body as { connectionConfig: ConnectionConfig };

  if (!connectionConfig) {
    return res.status(400).json({ 
      connected: false,
      error: 'Connection configuration is required' 
    });
  }

  try {
    const isConnected = await testConnection(connectionConfig);
    return res.status(200).json({ 
      connected: isConnected,
      ...(isConnected ? {} : { error: 'Connection test failed' })
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to connect to database';
    return res.status(500).json({ 
      connected: false,
      error: `Connection failed: ${errorMessage}`
    });
  }
});
