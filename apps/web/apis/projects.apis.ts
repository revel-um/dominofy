import { NextRouter } from "next/router";
import { handleServerError, handleUnauthorizedError } from "../utils/error.handler";

export class ProjectsApi {
    static async getProjects(token: string, router: NextRouter) {
        try {
            const response = await fetch("http://localhost:3001/api/v1/projects", {
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

    static async createProject(token: string, router: NextRouter, body: {
        name: string
        description?: string
    }) {
        try {
            const response = await fetch("http://localhost:3001/api/v1/projects", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
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