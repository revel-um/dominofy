// src/apis/workflows.api.ts
import { NextRouter } from "next/router";
import { handleServerError, handleUnauthorizedError } from "../utils/error.handler";
import { config } from "../config/config";

export class WorkflowsApi {
  static async getRecentWorkflowsAndCount(token: string, router: NextRouter) {
    try {
      const response = await fetch(`${config.backendBaseUrl}/workflow/recent`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorizedError(router);
      }

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
      
      const url = `${config.backendBaseUrl}/workflow/all${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorizedError(router);
      }

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async getWorkflowById(id: string, token: string, router: NextRouter) {
    try {
      const response = await fetch(`${config.backendBaseUrl}/workflow/${id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorizedError(router);
      }

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
      const response = await fetch(`${config.backendBaseUrl}/workflow/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ visualJson }),
      });

      if (response.status === 401) {
        handleUnauthorizedError(router);
      }

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async renameWorkflow(workflowId: string, newName: string, token: string, router: NextRouter) {
    try {
      const response = await fetch(`${config.backendBaseUrl}/workflow/${workflowId}/rename`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName }),
      });

      if (response.status === 401) {
        handleUnauthorizedError(router);
      }

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }
}
