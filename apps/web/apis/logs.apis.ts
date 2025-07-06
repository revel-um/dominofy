import { NextRouter } from "next/router";
import { handleServerError, handleUnauthorizedError } from "../utils/error.handler";
import { config } from "../config/config";

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

      if (runId)      query.set("runId", runId);
      if (search)     query.set("search", search);

      // If a date range is provided, use that; otherwise use 'minutes'
      if (startDate)  query.set("startDate", startDate);
      if (endDate)    query.set("endDate", endDate);
      if (!startDate && !endDate) {
        query.set("minutes", String(minutes));
      }

      const url = `${config.backendBaseUrl}/workflows/${workflowId}/logs?${query.toString()}`;
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
}
