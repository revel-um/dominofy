export function getUserId(): string {
  // Get user ID from your auth context or localStorage
  const user = localStorage.getItem('user');
  if (!user) return '';
  
  try {
    return JSON.parse(user).id;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return '';
  }
}