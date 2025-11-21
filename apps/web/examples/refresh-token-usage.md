# Refresh Token Implementation Usage Guide

## Overview
This implementation provides industrial-grade token management with automatic refresh, following the architecture:

```
Client                          Server
------                          ------
Login  →  Access Token ------------------>
          Refresh Token -----------------> stored in DB

Access token expires (24h)

Client → sends refresh token
Server → validates + rotates
Server → sends new access token
```

## Backend Integration

### 1. Database Migration
The `RefreshToken` entity needs to be added to your database. Run your migration system to create the `refresh_tokens` table.

### 2. Updated Login Flow
The `/api/v1/auth/exchange` endpoint now returns:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4e5f6g7h8i9j0..."
}
```

### 3. New Endpoints
- `POST /api/v1/auth/refresh` - Exchange refresh token for new access token
- `POST /api/v1/auth/logout` - Revoke refresh token

## Frontend Integration

### 1. OAuth Login Update
Update your OAuth success handler:

```typescript
// In your OAuth success handler
import { TokenManager } from '@/utils/auth';

const handleOAuthSuccess = async () => {
  try {
    const response = await fetch('/api/auth/exchange', {
      method: 'POST',
    });
    
    const data = await response.json();
    
    // Store both tokens
    TokenManager.setTokens(data.accessToken, data.refreshToken);
    
    // Store user data (decode from JWT or fetch from backend)
    TokenManager.setUser({
      id: 'user-id',
      email: 'user@example.com',
      name: 'User Name'
    });
    
    // Redirect to dashboard
    window.location.href = '/dashboard';
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

### 2. API Calls with Auto-Refresh
Replace direct fetch calls with the ApiClient:

```typescript
import { ApiClient } from '@/utils/api';

// Old way
const response = await fetch('/api/v1/workflows', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// New way (automatically handles token refresh)
const workflows = await ApiClient.get('/api/v1/workflows');
```

### 3. Protected Route Integration
Update your ProtectedRoute component:

```typescript
import { TokenManager } from '@/utils/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await TokenManager.getValidAccessToken();
      setIsAuthenticated(!!token);
      
      if (!token) {
        // Redirect to login
        window.location.href = '/auth/signin';
      }
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : null;
}
```

### 4. Logout Implementation
```typescript
import { TokenManager } from '@/utils/auth';

const handleLogout = async () => {
  await TokenManager.logout();
  window.location.href = '/auth/signin';
};
```

## Key Features

### 1. Automatic Token Refresh
- Tokens are automatically refreshed when expired
- No user interruption during API calls
- Fallback to login redirect if refresh fails

### 2. Token Rotation
- Each refresh generates a new access + refresh token pair
- Old refresh token is revoked for security
- Prevents token replay attacks

### 3. Secure Storage
- Refresh tokens stored securely in database
- Can be revoked server-side
- Automatic cleanup of expired tokens

### 4. Error Handling
- Graceful fallback when refresh fails
- Automatic redirect to login
- Clean token cleanup

## Migration from Existing Code

### 1. Update API Calls
```typescript
// Replace all instances of:
const token = localStorage.getItem('token');
fetch(url, { headers: { Authorization: `Bearer ${token}` }});

// With:
ApiClient.get(endpoint);
```

### 2. Update Token Storage
```typescript
// Replace:
localStorage.setItem('token', token);

// With:
TokenManager.setTokens(accessToken, refreshToken);
```

### 3. Update Auth Checks
```typescript
// Replace:
const token = localStorage.getItem('token');
const isAuthenticated = !!token;

// With:
const token = await TokenManager.getValidAccessToken();
const isAuthenticated = !!token;
```

## Environment Variables
Make sure you have:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
JWT_SECRET=your-jwt-secret
```

This implementation provides industrial-grade security with minimal code changes and seamless user experience!