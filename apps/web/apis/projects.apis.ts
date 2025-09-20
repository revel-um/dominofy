import { NextRouter } from "next/router";
import { handleServerError, handleUnauthorizedError } from "../utils/error.handler";
import { config } from "../config/config";

export class ProjectsApi {
    static async getProjects(token: string, router: NextRouter, limit=10, offset=0, query?: string) {
        try {
            const params = new URLSearchParams();
            params.set('limit', String(limit));
            params.set('offset', String(offset));
            if (query && query.trim().length > 0) params.set('query', query.trim());
            const url = `${config.backendBaseUrl}/projects?${params.toString()}`;
            const response = await fetch(url, {
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
            const response = await fetch(`${config.backendBaseUrl}/projects/create`, {
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

    static async getProjectOverview(token: string, router: NextRouter, projectId: string) {
        try {
            const response = await fetch(`${config.backendBaseUrl}/projects/${projectId}/overview`, {
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

    static async getGlobalOverview(token: string, router: NextRouter) {
        try {
            const response = await fetch(`${config.backendBaseUrl}/projects/overview`, {
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

    static async getProjectDetailsWithWorkflows(projectId: string, token: string, router: NextRouter) {
        try {
            const response = await fetch(`${config.backendBaseUrl}/projects/${projectId}/details-with-workflows`, {
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

    static async updateProject(projectId: string, data: { name?: string; description?: string }, token: string, router: NextRouter) {
        try {
            const response = await fetch(`${config.backendBaseUrl}/projects/${projectId}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
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