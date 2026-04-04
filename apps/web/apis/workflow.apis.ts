// src/apis/workflows.api.ts
import { NextRouter } from "next/router";
import { handleServerError } from "../utils/error.handler";
import { config } from "../config/config";
import { authFetch } from "../utils/authFetch";

export class WorkflowsApi {
  static async getRecentWorkflowsAndCount(
    token: string,
    router: NextRouter,
    query?: string,
  ) {
    try {
      const params = new URLSearchParams();
      if (query && query.trim().length > 0) params.set('query', query.trim());
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

  static async getAllUserWorkflows(token: string, router: NextRouter, limit?: number, offset?: number) {
    try {
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());

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
