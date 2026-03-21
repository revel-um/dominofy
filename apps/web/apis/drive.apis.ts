import { NextRouter } from 'next/router';
import { handleServerError } from '@/utils/error.handler';
import { config } from '@/config/config';
import { authFetch } from '@/utils/authFetch';

export interface DriveConnection {
  id: string;
  name: string;
  email?: string;
}

export class DriveApi {
  static async getInstallUrl(token: string, router: NextRouter) {
    try {
      const r = await authFetch(`${config.backendBaseUrl}/drive/google/install-url`, {
        token,
      }, router);
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
      const r = await authFetch(`${config.backendBaseUrl}/drive/connections`, {
        token,
      }, router);
      return (await r.json()) as DriveConnection[];
    } catch (err) {
      handleServerError(router, err);
      return [];
    }
  }
}
