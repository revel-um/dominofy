import { Pool, PoolConfig, QueryResult } from 'pg';

type ConnectionConfig = {
  user?: string;
  host?: string;
  database?: string;
  password?: string;
  port?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
};

// Default connection pool (for application database)
let defaultPool: Pool | null = null;
// Map to store connection pools for different users/sessions
const connectionPools = new Map<string, Pool>();

// Initialize the default connection pool
function initDefaultPool() {
  if (!defaultPool) {
    const config: PoolConfig = {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '5432'),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    defaultPool = new Pool(config);
  }
  return defaultPool;
}

// Get or create a connection pool for a specific connection
function getPool(connectionId: string, config?: ConnectionConfig): Pool {
  if (!connectionId) {
    return initDefaultPool();
  }
  
  if (!connectionPools.has(connectionId)) {
    if (!config) {
      throw new Error('Connection config is required for new connections');
    }
    
    const poolConfig: PoolConfig = {
      ...config,
      max: 5, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
      connectionTimeoutMillis: 2000, // How long to wait when connecting a new client
    };
    
    connectionPools.set(connectionId, new Pool(poolConfig));
  }
  
  return connectionPools.get(connectionId)!;
}

// Test a database connection
async function testConnection(config: ConnectionConfig): Promise<boolean> {
  const testPool = new Pool({
    ...config,
    max: 1,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 5000
  });
  
  try {
    const client = await testPool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Connection test failed:', error);
    throw error;
  } finally {
    await testPool.end();
  }
}

// Execute a SQL query with optional connection config
async function executeQuery(
  query: string, 
  params: any[] = [], 
  connectionId?: string,
  config?: ConnectionConfig
): Promise<QueryResult> {
  const pool = connectionId ? getPool(connectionId, config) : initDefaultPool();
  const client = await pool.connect();
  
  try {
    const start = Date.now();
    const result = await client.query(query, params);
    const duration = Date.now() - start;
    
    return result;
  } catch (error) {
    console.error('Error executing query:', { 
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  } finally {
    client.release();
  }
}

// Close all connections for a specific connection ID
async function closeConnection(connectionId: string): Promise<void> {
  const pool = connectionPools.get(connectionId);
  if (pool) {
    await pool.end();
    connectionPools.delete(connectionId);
  }
}

// Export types using export type
export type { ConnectionConfig };

// Export functions
export { 
  testConnection, 
  executeQuery, 
  closeConnection 
};
