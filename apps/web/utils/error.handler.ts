// utils/handleServerError.ts
import { NextRouter } from "next/router";
import { TokenManager } from "./auth";

export const handleServerError = (router: NextRouter, err: any) => {
    sessionStorage.setItem("error-message", err?.message);
    router.push("/error");
};

export const handleUnauthorizedError = (router: NextRouter) => {
    // remove tokens from local storage
    TokenManager.clearTokens();
    localStorage.removeItem("token");
    console.error("Unauthorized Error");
    router.push("/auth");
}
