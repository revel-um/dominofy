import { TokenManager } from './auth';

const getBackendApiBase = () =>
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL?.trim().replace(/\/+$/, '') ||
  `${(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001').replace(/\/+$/, '')}/api/v1`;

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private static readonly baseURL = getBackendApiBase();

  static async request<T = any>(
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<T> {
    const { skipAuth = false, ...fetchOptions } = options;
    
    const url = `${this.baseURL}${endpoint}`;
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    // Add authorization header if not skipped
    if (!skipAuth) {
      const token = await TokenManager.getValidAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    // Make the request
    let response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (response.status === 401 && !skipAuth) {
      const newToken = await TokenManager.refreshAccessToken();

      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;

        response = await fetch(url, {
          ...fetchOptions,
          headers,
        });
      } else {
        if (typeof window !== 'undefined') {
          TokenManager.clearTokens();
          window.location.href = '/auth/signin';
        }
        throw new Error('Authentication failed');
      }
    }

    if (response.status === 401 && !skipAuth) {
      if (typeof window !== 'undefined') {
        TokenManager.clearTokens();
        window.location.href = '/auth/signin';
      }
      throw new Error('Authentication failed');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  static async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  static async post<T = any>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async put<T = any>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async delete<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  static async patch<T = any>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

export { ApiClient };
