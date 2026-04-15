import { NextRouter } from "next/router";
import { handleServerError } from "../utils/error.handler";
import { config } from "../config/config";
import { authFetch } from "../utils/authFetch";

export interface GetLogsParams {
  runId?: string;
  offset?: number;
  limit?: number;
  search?: string;
  minutes?: number;
  startDate?: string;  // ISO date, e.g. "2025-07-07"
  endDate?: string;    // ISO date, e.g. "2025-07-08"
}

export class LogsApi {
  static async getExecutionLogs(
    executionId: string,
    token: string,
    router: NextRouter,
    params: { offset?: number; limit?: number } = {},
  ) {
    const { offset = 0, limit = 200 } = params;

    try {
      const query = new URLSearchParams();
      query.set("offset", String(offset));
      query.set("limit", String(limit));

      const url = `${config.backendBaseUrl}/workflows/placeholder/logs/by-execution/${executionId}?${query.toString()}`;
      const response = await authFetch(url, {
        method: "GET",
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  /**
   * Fetch paginated logs for a given workflow, filtered either by
   * last-N-minutes or by explicit date range.
   */
  static async getLogs(
    workflowId: string,
    token: string,
    router: NextRouter,
    params: GetLogsParams = {}
  ) {
    const {
      runId,
      offset = 1,
      limit = 50,
      search,
      minutes = 0,
      startDate,
      endDate,
    } = params;

    try {
      const query = new URLSearchParams();
      query.set("offset", String(offset));
      query.set("limit", String(limit));

      if (runId) query.set("runId", runId);
      if (search) query.set("search", search);

      // normalize date range to full-day ISO windows
      if (startDate) {
        // build YYYY-MM-DDT00:00:00.000Z
        const [y, m, d] = startDate.split("-").map(Number);
        const sd = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        query.set("startDate", sd.toISOString());
      }
      if (endDate) {
        // build YYYY-MM-DDT23:59:59.999Z
        const [y, m, d] = endDate.split("-").map(Number);
        const ed = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
        query.set("endDate", ed.toISOString());
      }

      // only use minutes when no explicit date range
      if (!startDate && !endDate) {
        query.set("minutes", String(minutes));
      }

      const url = `${config.backendBaseUrl}/workflows/${workflowId}/logs?${query.toString()}`;
      const response = await authFetch(url, {
        method: "GET",
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

}
