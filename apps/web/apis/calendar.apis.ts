import { NextRouter } from 'next/router';
import { handleServerError } from '@/utils/error.handler';
import { config } from '@/config/config';
import { authFetch } from '@/utils/authFetch';

export interface CalendarConnection {
  id: string;
  name: string;
  email?: string;
}

export interface CalendarListItem {
  id: string;
  summary: string;
  primary?: boolean;
  timeZone?: string;
}

export class CalendarApi {
  static async getInstallUrl(token: string, router: NextRouter) {
    try {
      const r = await authFetch(`${config.backendBaseUrl}/calendar/google/install-url`, {
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
  ): Promise<CalendarConnection[]> {
    try {
      const r = await authFetch(`${config.backendBaseUrl}/calendar/connections`, {
        token,
      }, router);
      return (await r.json()) as CalendarConnection[];
    } catch (err) {
      handleServerError(router, err);
      return [];
    }
  }

  static async getCalendars(
    token: string,
    router: NextRouter,
    vaultId: string,
  ): Promise<CalendarListItem[]> {
    try {
      const r = await authFetch(
        `${config.backendBaseUrl}/calendar/calendars?vaultId=${encodeURIComponent(vaultId)}`,
        { token },
        router,
      );
      return (await r.json()) as CalendarListItem[];
    } catch (err) {
      handleServerError(router, err);
      return [];
    }
  }
}
