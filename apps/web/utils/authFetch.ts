import { NextRouter } from "next/router";
import { TokenManager } from "./auth";
import { handleUnauthorizedError } from "./error.handler";

interface AuthFetchOptions extends RequestInit {
  token?: string;
  skipAuth?: boolean;
}

export async function authFetch(
  url: string,
  options: AuthFetchOptions = {},
  router?: NextRouter
): Promise<Response> {
  const { token, skipAuth = false, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  if (!skipAuth) {
    const storedToken = await TokenManager.getValidAccessToken();
    const legacyToken =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const authToken = storedToken || token || legacyToken;
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401 && !skipAuth) {
    const newToken = await TokenManager.refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      return fetch(url, {
        ...fetchOptions,
        headers,
      });
    }

    if (router) {
      handleUnauthorizedError(router);
    }
  }

  return response;
}
