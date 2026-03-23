import type { NextApiRequest, NextApiResponse } from 'next';
import { executeQuery, testConnection, closeConnection, ConnectionConfig } from '@/lib/db';

type ResponseData = {
  data?: any;
  error?: string;
};

type ExecuteRequest = {
  query: string;
  connectionId?: string;
  connectionConfig?: ConnectionConfig;
};

function getConnectionId(req: NextApiRequest): string | undefined {
  const queryConnectionId = Array.isArray(req.query.connectionId)
    ? req.query.connectionId[0]
    : req.query.connectionId;
  const bodyConnectionId =
    typeof req.body === 'object' && req.body && 'connectionId' in req.body
      ? (req.body.connectionId as string | undefined)
      : undefined;

  return queryConnectionId || bodyConnectionId;
}

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
export async function testDbConnection(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { connectionConfig } = req.body as { connectionConfig: ConnectionConfig };

  if (!connectionConfig) {
    return res.status(400).json({ error: 'Connection configuration is required' });
  }

  try {
    const isConnected = await testConnection(connectionConfig);
    return res.status(200).json({ 
      data: { connected: isConnected } 
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to connect to database';
    return res.status(500).json({ 
      error: `Connection failed: ${errorMessage}` 
    });
  }
}

// API endpoint to execute SQL queries
export async function executeSqlQuery(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, connectionId, connectionConfig } = req.body as ExecuteRequest;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  // For new connections, require connection config
  if (connectionId && !connectionConfig) {
    return res.status(400).json({ error: 'Connection configuration is required' });
  }

  try {
    // Execute the SQL query using our PostgreSQL client
    const result = await executeQuery(
      query,
      [],
      connectionId,
      connectionConfig
    );

    // For SELECT queries, include fields information
    // For INSERT/UPDATE/DELETE, just return the row count
    const responseData: any = {
      rows: result.rows || [],
      rowCount: result.rowCount || 0
    };

    // Only include fields for SELECT queries (where fields exist)
    if (result.fields) {
      responseData.fields = result.fields.map(field => ({
        name: field.name,
        dataTypeID: field.dataTypeID,
        format: field.format
      }));
    }

    return res.status(200).json({ 
      data: responseData
    });
  } catch (error) {
    console.error('Error executing SQL:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({ 
      error: `Database error: ${errorMessage}`
    });
  }
}

export async function disconnectSqlConnection(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const connectionId = getConnectionId(req);
  if (!connectionId) {
    return res.status(400).json({ error: 'Connection ID is required' });
  }

  try {
    await closeConnection(connectionId);
    return res.status(200).json({
      data: {
        disconnected: true,
        connectionId,
      },
    });
  } catch (error) {
    console.error('Error disconnecting SQL connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({
      error: `Disconnect failed: ${errorMessage}`,
    });
  }
}

// Main API handler
export default allowCors(async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { action } = req.query;

  try {
    if (req.method === 'DELETE' || action === 'disconnect') {
      return await disconnectSqlConnection(req, res);
    }

    switch (action) {
      case 'test-connection':
        return await testDbConnection(req, res);
      case 'execute':
      default:
        return await executeSqlQuery(req, res);
    }
  } catch (error) {
    console.error('API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({ 
      error: `API error: ${errorMessage}`
    });
  }
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
