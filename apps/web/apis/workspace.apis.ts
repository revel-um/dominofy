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

export class WorkspaceApi {
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
}
