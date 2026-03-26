import { NextRouter } from "next/router";
import { handleServerError } from "../utils/error.handler";
import { authFetch } from "../utils/authFetch";
import { config } from "../config/config";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string | null;
  role: string;
  projectCount: number;
  memberCount: number;
}

export interface WorkspaceListItem extends WorkspaceSummary {
  createdById: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  isOwnedByUser: boolean;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  acceptanceStatus?: 'pending' | 'accepted';
}

export class WorkspaceApi {
  static async createWorkspace(
    body: { name: string; slug?: string },
    token: string,
    router: NextRouter,
  ) {
    try {
      return await authFetch(
        `${config.backendBaseUrl}/workspace`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          token,
        },
        router,
      );
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async listWorkspaces(
    token: string,
    router: NextRouter,
    query?: string,
  ) {
    try {
      const params = new URLSearchParams();
      if (query && query.trim().length > 0) params.set('query', query.trim());
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return await authFetch(
        `${config.backendBaseUrl}/workspace${suffix}`,
        { token },
        router,
      );
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async getCurrentWorkspaceSummary(
    token: string,
    router: NextRouter,
    workspaceId?: string,
  ) {
    try {
      const params = new URLSearchParams();
      if (workspaceId) params.set("workspaceId", workspaceId);
      const suffix = params.toString() ? `?${params.toString()}` : "";

      const response = await authFetch(
        `${config.backendBaseUrl}/workspace/current/summary${suffix}`,
        { token },
        router,
      );

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async getWorkspaceMembers(
    workspaceId: string,
    token: string,
    router: NextRouter,
    options?: { limit?: number; offset?: number },
  ) {
    try {
      const params = new URLSearchParams();
      if (typeof options?.limit === 'number') params.set('limit', String(options.limit));
      if (typeof options?.offset === 'number') params.set('offset', String(options.offset));
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return await authFetch(
        `${config.backendBaseUrl}/workspace/${workspaceId}/members${suffix}`,
        { token },
        router,
      );
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async inviteWorkspaceMember(
    workspaceId: string,
    body: { email: string; role?: string },
    token: string,
    router: NextRouter,
  ) {
    try {
      return await authFetch(
        `${config.backendBaseUrl}/workspace/${workspaceId}/invite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          token,
        },
        router,
      );
    } catch (err) {
      handleServerError(router, err);
    }
  }
}
