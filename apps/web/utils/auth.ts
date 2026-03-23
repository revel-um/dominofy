interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

interface UserData {
  id: string;
  email: string;
  name?: string;
}

const getBackendApiBase = (): string => {
  const apiBase = process.env.NEXT_PUBLIC_BACKEND_BASE_URL?.trim();
  if (apiBase) return apiBase.replace(/\/+$/, '');

  const originBase = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (originBase) return `${originBase.replace(/\/+$/, '')}/api/v1`;

  return 'http://localhost:3001/api/v1';
};

class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'accessToken';
  private static readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private static readonly USER_KEY = 'user';
  private static readonly TOKEN_EXPIRY_KEY = 'tokenExpiresAt';
  private static refreshPromise: Promise<string | null> | null = null;

  private static decodeExp(token: string): number | null {
    try {
      const [, payload] = token.split('.');
      const decoded = JSON.parse(atob(payload));
      return typeof decoded?.exp === 'number' ? decoded.exp * 1000 : null;
    } catch (err) {
      console.warn('Failed to decode token exp', err);
      return null;
    }
  }

  static setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;

    const decodedExp = this.decodeExp(accessToken);
    const fallbackSeconds =
      Number(process.env.NEXT_PUBLIC_ACCESS_TOKEN_TTL_SECONDS) || 24 * 60 * 60;
    const expiresAt =
      decodedExp && Number.isFinite(decodedExp)
        ? decodedExp
        : Date.now() + fallbackSeconds * 1000;

    // Keep legacy token key in sync for existing callers
    localStorage.setItem("token", accessToken);
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiresAt.toString());
  }

  static getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.ACCESS_TOKEN_KEY) || localStorage.getItem("token");
  }

  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static isTokenExpired(): boolean {
    if (typeof window === 'undefined') return true;
    
    const expiryTime = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiryTime) return true;
    
    return Date.now() > parseInt(expiryTime);
  }

  static clearTokens(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem("token");
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.clearClientCaches();
  }

  private static clearClientCaches(): void {
    if (typeof window === 'undefined') return;

    const localStorageKeysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key === 'dominofy-tabs' ||
        key.startsWith('dominofy-tabs:') ||
        key === 'dominofy-last-active-tab' ||
        key.startsWith('dominofy-last-active-tab:')
      ) {
        localStorageKeysToRemove.push(key);
      }
    }
    localStorageKeysToRemove.forEach((key) => localStorage.removeItem(key));

    const sessionStorageKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (
        key === 'workflow-cache' ||
        key === 'tabViewports' ||
        key === 'codeEditorResult' ||
        key.startsWith('workflow-')
      ) {
        sessionStorageKeysToRemove.push(key);
      }
    }
    sessionStorageKeysToRemove.forEach((key) => sessionStorage.removeItem(key));
  }

  static setUser(user: UserData): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static getUser(): UserData | null {
    if (typeof window === 'undefined') return null;
    
    const user = localStorage.getItem(this.USER_KEY);
    if (!user) return null;
    
    try {
      return JSON.parse(user);
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }

  static async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefreshAccessToken();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private static async performRefreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const backendApiBase = getBackendApiBase();
      const response = await fetch(`${backendApiBase}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (!data?.accessToken || !data?.refreshToken) {
        return null;
      }

      this.setTokens(data.accessToken, data.refreshToken);

      return data.accessToken;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  static async getValidAccessToken(): Promise<string | null> {
    let token = this.getAccessToken();

    if (!token) {
      token = await this.refreshAccessToken();
    }

    // If token is expired, try to refresh
    if (token && this.isTokenExpired()) {
      token = await this.refreshAccessToken();
    }

    return token;
  }

  static async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    
    // Notify backend about logout
    if (refreshToken) {
      try {
        const backendApiBase = getBackendApiBase();
        await fetch(`${backendApiBase}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (error) {
        console.error('Error during logout:', error);
      }
    }

    this.clearTokens();
  }
}

// Legacy function for backward compatibility
export function getUserId(): string {
  const user = TokenManager.getUser();
  return user?.id || '';
}

export { TokenManager };
