import { createClient } from '@supabase/supabase-js';

// These environment variables should be set in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to execute raw SQL queries
export const executeSQL = async (query: string) => {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { query });
    
    if (error) {
      console.error('SQL execution error:', error);
      throw new Error(error.message);
    }
    
    return data;
  } catch (error) {
    console.error('Error in executeSQL:', error);
    throw error;
  }
};
