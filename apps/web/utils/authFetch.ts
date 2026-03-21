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
  const baseHeaders: Record<string, string> = {
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  const executeRequest = async (authToken?: string | null) => {
    const headers = { ...baseHeaders };
    if (!skipAuth) {
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      } else {
        delete headers.Authorization;
      }
    }

    return fetch(url, {
      ...fetchOptions,
      headers,
    });
  };

  let authToken: string | null | undefined = token;

  if (!skipAuth) {
    const storedToken = await TokenManager.getValidAccessToken();
    const legacyToken =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    authToken = storedToken || token || legacyToken;
  }

  let response = await executeRequest(authToken);

  if (response.status !== 401 || skipAuth) {
    return response;
  }

  const refreshedToken = await TokenManager.refreshAccessToken();
  if (!refreshedToken) {
    if (router) {
      handleUnauthorizedError(router);
    } else {
      TokenManager.clearTokens();
    }
    return response;
  }

  response = await executeRequest(refreshedToken);

  if (response.status === 401) {
    if (router) {
      handleUnauthorizedError(router);
    } else {
      TokenManager.clearTokens();
    }
  }

  return response;
}
