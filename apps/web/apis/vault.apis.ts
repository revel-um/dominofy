// src/apis/vaults.api.ts
import { NextRouter } from "next/router";
import { handleServerError, handleUnauthorizedError } from "../utils/error.handler";
import { config } from "../config/config";
import { authFetch } from "../utils/authFetch";

export interface CreateVaultPayload {
  name: string;
  type: string;
  connection: Record<string, any>;
}

export class VaultsApi {
  static async getVaultTypes(token: string, router: NextRouter) {
    try {
      const response = await fetch(`${config.backendBaseUrl}/vault/types`, {
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

  /**
   * Fetch paginated list of vault connections.
   */
  static async getVaults(
    token: string,
    router: NextRouter,
    page: number = 1,
    limit: number = 10
  ) {
    try {
      const response = await authFetch(
        `${config.backendBaseUrl}/vault?page=${page}&limit=${limit}`,
        {
          method: "GET",
          token,
        },
        router
      );

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  /**
   * Create a new vault connection.
   */
  static async createVault(
    payload: CreateVaultPayload,
    token: string,
    router: NextRouter
  ) {
    try {
      const response = await authFetch(`${config.backendBaseUrl}/vault`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        token,
      }, router);

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  /**
   * Delete a vault connection by ID.
   */
  static async deleteVault(
    id: string,
    token: string,
    router: NextRouter
  ) {
    try {
      const response = await authFetch(
        `${config.backendBaseUrl}/vault/${id}`,
        {
          method: "DELETE",
          token,
        },
        router
      );

      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }
}
