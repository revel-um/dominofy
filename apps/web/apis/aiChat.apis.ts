import { NextRouter } from "next/router";
import { config } from "../config/config";
import { handleServerError, handleUnauthorizedError } from "../utils/error.handler";

export type AiChatSender = 'user' | 'ai';

export interface AiChatMessageDto {
  id: string;
  sender: AiChatSender;
  content: string;
  createdAt: string;
}

export interface FetchAiMessagesParams {
  limit?: number;
  before?: string;
}

export class AiChatApi {
  static async getMessages(
    workflowId: string,
    token: string,
    router: NextRouter,
    params: FetchAiMessagesParams = {}
  ) {
    try {
      const query = new URLSearchParams();
      query.set('limit', String(params.limit ?? 25));
      if (params.before) {
        query.set('before', params.before);
      }

      const url = `${config.backendBaseUrl}/ai-chat/workflow/${workflowId}/messages?${query.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
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

  static async saveMessage(
    workflowId: string,
    payload: { content: string; sender: AiChatSender },
    token: string,
    router: NextRouter
  ) {
    try {
      const response = await fetch(`${config.backendBaseUrl}/ai-chat/workflow/${workflowId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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
