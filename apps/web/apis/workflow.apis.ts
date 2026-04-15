// src/apis/workflows.api.ts
import { NextRouter } from "next/router";
import { handleServerError } from "../utils/error.handler";
import { config } from "../config/config";
import { authFetch } from "../utils/authFetch";

export class WorkflowsApi {
  static async getExecutionById(
    executionId: string,
    token: string,
    router: NextRouter,
  ) {
    try {
      const response = await authFetch(`${config.backendBaseUrl}/workflow/execution/${executionId}`, {
        method: "GET",
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async getExecutionMetrics(
    workflowId: string,
    token: string,
    router: NextRouter,
    limit?: number,
    offset?: number,
    version?: number,
    options?: {
      allVersions?: boolean;
      status?: "running" | "success" | "failure";
      startDate?: string;
      endDate?: string;
    },
  ) {
    try {
      const params = new URLSearchParams();
      if (typeof limit === "number") params.set("limit", String(limit));
      if (typeof offset === "number") params.set("offset", String(offset));
      if (typeof version === "number") params.set("version", String(version));
      if (options?.allVersions) params.set("allVersions", "true");
      if (options?.status) params.set("status", options.status);
      if (options?.startDate) params.set("startDate", options.startDate);
      if (options?.endDate) params.set("endDate", options.endDate);

      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await authFetch(`${config.backendBaseUrl}/workflow/${workflowId}/metrics${suffix}`, {
        method: "GET",
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async getRecentWorkflowsAndCount(
    token: string,
    router: NextRouter,
    query?: string,
    workspaceId?: string,
  ) {
    try {
      const params = new URLSearchParams();
      if (query && query.trim().length > 0) params.set('query', query.trim());
      if (workspaceId) params.set('workspaceId', workspaceId);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await authFetch(`${config.backendBaseUrl}/workflow/recent${suffix}`, {
        method: "GET",
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async getAllUserWorkflows(token: string, router: NextRouter, limit?: number, offset?: number, workspaceId?: string) {
    try {
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());
      if (workspaceId) params.append('workspaceId', workspaceId);

      const url = `${config.backendBaseUrl}/workflow/user/all${params.toString() ? '?' + params.toString() : ''}`;

      const response = await authFetch(url, {
        method: "GET",
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async getWorkflowById(id: string, token: string, router: NextRouter) {
    try {
      const response = await authFetch(`${config.backendBaseUrl}/workflow/${id}`, {
        method: "GET",
        token,
      }, router);

      if (response.status === 404 || response.status === 403) {
        handleServerError(router, new Error("Access denied to this workflow"));
      }

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async getDeployedWorkflowById(id: string, token: string, router: NextRouter) {
    try {
      const response = await authFetch(`${config.backendBaseUrl}/workflow/${id}/deployed`, {
        method: "GET",
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async saveWorkflow(id: string, visualJson: string, token: string, router: NextRouter) {
    try {
      const response = await authFetch(`${config.backendBaseUrl}/workflow/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ visualJson }),
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async deployWorkflow(id: string, token: string, router: NextRouter) {
    try {
      const response = await authFetch(`${config.backendBaseUrl}/workflow/${id}/deploy`, {
        method: "POST",
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async renameWorkflow(workflowId: string, newName: string, token: string, router: NextRouter) {
    try {
      const response = await authFetch(`${config.backendBaseUrl}/workflow/${workflowId}/rename`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName }),
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async deleteWorkflow(workflowId: string, token: string, router: NextRouter) {
    try {
      const response = await authFetch(`${config.backendBaseUrl}/workflow/${workflowId}`, {
        method: "DELETE",
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async getEntryWorkflow(projectId: string, token: string, router: NextRouter) {
    try {
      const response = await authFetch(`${config.backendBaseUrl}/workflow/project/${projectId}/entry`, {
        method: "GET",
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async saveComments(id: string, comments: string, token: string, router: NextRouter) {
    try {
      const response = await authFetch(`${config.backendBaseUrl}/workflow/${id}/comments`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comments }),
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async createWorkflow(name: string, projectId: string, token: string, router: NextRouter) {
    try {
      const response = await authFetch(`${config.backendBaseUrl}/workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          projectId,
          visualJson: { nodes: [], edges: [] } // Empty workflow
        }),
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }
}
