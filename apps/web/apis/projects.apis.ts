import { NextRouter } from "next/router";
import { handleServerError, handleUnauthorizedError } from "../utils/error.handler";
import { config } from "../config/config";

export class ProjectsApi {
    static async getProjects(token: string, router: NextRouter, limit=10, offset=0, query?: string) {
        try {
            const response = await fetch(`${config.bakendBaseUrl}/projects?limit=${limit}&offset=${offset}&query=${query}`, {
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
            const response = await fetch(`${config.bakendBaseUrl}/projects`, {
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