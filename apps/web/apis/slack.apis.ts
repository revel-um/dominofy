import { NextRouter } from 'next/router';
import {
  handleServerError,
  handleUnauthorizedError,
} from '@/utils/error.handler';
import { config } from '@/config/config';

export class SlackApi {
  /* ─────────── install URL (new endpoint) ─────────── */
  static async getInstallUrl(token: string, router: NextRouter) {
    try {
      const r = await fetch(`${config.backendBaseUrl}/slack/install-url`, {
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

  /* ─────────── connections & channels ─────────── */
  static async getConnections(token: string, router: NextRouter) {
    try {
      const r = await fetch(`${config.backendBaseUrl}/slack/connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401) return handleUnauthorizedError(router);
      return (await r.json()) as { id: string; name: string }[];
    } catch (err) {
      handleServerError(router, err);
      return [];
    }
  }

  static async getChannels(token: string, router: NextRouter, vaultId: string) {
    try {
      const r = await fetch(
        `${config.backendBaseUrl}/slack/channels?vaultId=${vaultId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (r.status === 401) return handleUnauthorizedError(router);
      return (await r.json()) as { id: string; name: string }[];
    } catch (err) {
      handleServerError(router, err);
      return [];
    }
  }
}
