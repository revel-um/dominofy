import { NextRouter } from 'next/router';
import { handleServerError } from '@/utils/error.handler';
import { config } from '@/config/config';
import { authFetch } from '@/utils/authFetch';

export interface EmailConnection {
  id: string;
  name: string;
  email?: string;
  provider?: string;
}

export interface CreateEmailConnectionPayload {
  name?: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  secure?: boolean;
}

export class EmailApi {
  static async getInstallUrl(token: string, router: NextRouter) {
    try {
      const r = await authFetch(`${config.backendBaseUrl}/email/google/install-url`, {
        token,
      }, router);
      if (r.status === 401) return '';
      const { url } = await r.json();
      return url as string;
    } catch (err) {
      handleServerError(router, err);
      return '';
    }
  }

  static async getConnections(
    token: string,
    router: NextRouter,
  ): Promise<EmailConnection[]> {
    try {
      const r = await authFetch(`${config.backendBaseUrl}/email/connections`, {
        token,
      }, router);
      if (r.status === 401) return [];
      return (await r.json()) as EmailConnection[];
    } catch (err) {
      handleServerError(router, err);
      return [];
    }
  }

  static async createConnection(
    token: string,
    router: NextRouter,
    payload: CreateEmailConnectionPayload,
  ): Promise<EmailConnection | null> {
    try {
      const r = await authFetch(`${config.backendBaseUrl}/email/connections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        token,
      }, router);
      if (r.status === 401) return null;
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j?.message || `HTTP ${r.status}`);
      }
      return (await r.json()) as EmailConnection;
    } catch (err) {
      handleServerError(router, err);
      return null;
    }
  }
}
