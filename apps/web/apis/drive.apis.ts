import { NextRouter } from 'next/router';
import {
  handleServerError,
  handleUnauthorizedError,
} from '@/utils/error.handler';
import { config } from '@/config/config';

export interface DriveConnection {
  id: string;
  name: string;
  email?: string;
}

export class DriveApi {
  static async getInstallUrl(token: string, router: NextRouter) {
    try {
      const r = await fetch(`${config.backendBaseUrl}/drive/google/install-url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401) return handleUnauthorizedError(router);
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
  ): Promise<DriveConnection[]> {
    try {
      const r = await fetch(`${config.backendBaseUrl}/drive/connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401) {
        handleUnauthorizedError(router);
        return [];
      }
      return (await r.json()) as DriveConnection[];
    } catch (err) {
      handleServerError(router, err);
      return [];
    }
  }
}
