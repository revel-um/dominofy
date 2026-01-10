import { NextRouter } from 'next/router';
import { handleServerError } from '@/utils/error.handler';
import { config } from '@/config/config';
import { authFetch } from '@/utils/authFetch';

export interface SlackConnection {
  id: string;
  name: string;
  slackTeamId: string;
}

export class SlackApi {
  /* ─────────── install URL (new endpoint) ─────────── */
  static async getInstallUrl(token: string, router: NextRouter) {
    try {
      const r = await authFetch(`${config.backendBaseUrl}/slack/install-url`, {
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

  /* ─────────── connections & channels ─────────── */
  static async getConnections(token: string, router: NextRouter): Promise<SlackConnection[]> {
    try {
      const r = await authFetch(`${config.backendBaseUrl}/slack/connections`, {
        token,
      }, router);
      if (r.status === 401) return [];
      const json = await r.json();
      // JSON coming from your backend must include slackTeamId
      return (json as any[]).map(item => {
        return {
          id: item.id,
          name: item.name,
          slackTeamId: item.lookupIds?.slackTeamId,
        }
      });
    } catch (err) {
      handleServerError(router, err);
      return [];
    }
  }

  static async inviteBot(
    token: string,
    router: NextRouter,
    vaultId: string,
    channelId: string,
  ): Promise<boolean> {
    try {
      const r = await authFetch(
        `${config.backendBaseUrl}/slack/channels/${channelId}/invite?vaultId=${vaultId}`,
        {
          method: 'POST',
          token,
        },
        router,
      );

      if (r.status === 401) return false;
      if (!r.ok) {
        const { error } = (await r.json()) ?? {};
        throw new Error(error || `HTTP ${r.status}`);
      }

      return true;
    } catch (err) {
      handleServerError(router, err);
      return false;
    }
  }

  static async getChannels(token: string, router: NextRouter, vaultId: string) {
    try {
      const r = await authFetch(
        `${config.backendBaseUrl}/slack/channels?vaultId=${vaultId}`,
        { token },
        router,
      );
      if (r.status === 401) return [];
      return (await r.json()) as { id: string; name: string; isMember: boolean, isPrivate: boolean }[];
    } catch (err) {
      handleServerError(router, err);
      return [];
    }
  }
}
