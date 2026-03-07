// utils/handleServerError.ts
import { NextRouter } from "next/router";
import { TokenManager } from "./auth";

export const handleServerError = (router: NextRouter, err: any) => {
    sessionStorage.setItem("error-message", err?.message);
    router.push("/error");
};

export const handleUnauthorizedError = (router: NextRouter) => {
    // remove auth data and client-side caches
    TokenManager.clearTokens();
    console.error("Unauthorized Error");
    router.push("/auth");
}
