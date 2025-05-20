// src/apis/workflows.api.ts
import { NextRouter } from "next/router";
import { handleServerError, handleUnauthorizedError } from "../utils/error.handler";

export class WorkflowsApi {
  static async getRecentWorkflowsAndCount(token: string, router: NextRouter) {
    try {
      const response = await fetch("http://localhost:3001/api/v1/workflow/recent", {
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
}
