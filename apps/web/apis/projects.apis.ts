import { NextRouter } from "next/router";
import { handleServerError } from "../utils/error.handler";
import { authFetch } from "../utils/authFetch";
import { config } from "../config/config";

export class ProjectsApi {
    static async getProjects(token: string, router: NextRouter, limit=10, offset=0, query?: string) {
        try {
            const params = new URLSearchParams();
            params.set('limit', String(limit));
            params.set('offset', String(offset));
            if (query && query.trim().length > 0) params.set('query', query.trim());
            const url = `${config.backendBaseUrl}/projects?${params.toString()}`;
            const response = await authFetch(url, {
                token,
            }, router);
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
            const response = await authFetch(`${config.backendBaseUrl}/projects/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
                token,
            }, router);
            return response;
        } catch (err) {
            handleServerError(router, err);
        }
    }

    static async getProjectOverview(token: string, router: NextRouter, projectId: string) {
        try {
            const response = await authFetch(`${config.backendBaseUrl}/projects/${projectId}/overview`, {
                token,
            }, router);
            return response;
        } catch (err) {
            handleServerError(router, err);
        }
    }

    static async getGlobalOverview(token: string, router: NextRouter) {
        try {
            const response = await authFetch(`${config.backendBaseUrl}/projects/overview`, {
                token,
            }, router);
            return response;
        } catch (err) {
            handleServerError(router, err);
        }
    }

    static async getProjectDetailsWithWorkflows(projectId: string, token: string, router: NextRouter) {
        try {
            const response = await authFetch(`${config.backendBaseUrl}/projects/${projectId}/details-with-workflows`, {
                token,
            }, router);
            return response;
        } catch (err) {
            handleServerError(router, err);
        }
    }

    static async updateProject(projectId: string, data: { name?: string; description?: string }, token: string, router: NextRouter) {
        try {
            const response = await authFetch(`${config.backendBaseUrl}/projects/${projectId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
                token,
            }, router);
            return response;
        } catch (err) {
            handleServerError(router, err);
        }
    }
}
