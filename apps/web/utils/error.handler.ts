// utils/handleServerError.ts
import { NextRouter } from "next/router";

export const handleServerError = (router: NextRouter, err: any) => {
    sessionStorage.setItem("error-message", err?.message);
    router.push("/error");
};

export const handleUnauthorizedError = (router: NextRouter) => {
    // remove token from local storage
    localStorage.removeItem("token");
    console.error("Unauthorized Error");
    router.push("/auth");
}
