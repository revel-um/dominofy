export const executeSQL = async (query: string) => {
  try {
    const response = await fetch('/api/sql/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to execute SQL query');
    }

    return await response.json();
  } catch (error) {
    console.error('Error executing SQL:', error);
    throw error;
  }
};
