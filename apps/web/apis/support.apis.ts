import { NextRouter } from "next/router";
import { Ticket, TicketStatus, TicketFormData } from "../types/support";
import { handleServerError, handleUnauthorizedError } from "../utils/error.handler";

const BASE_URL = "http://localhost:3001/api/v1/support";

export class SupportApi {
  static async getTickets(token: string, router: NextRouter) {
    try {
      const response = await fetch(`${BASE_URL}/tickets`, {
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

  static async createTicket(token: string, router: NextRouter, formData: TicketFormData) {
    try {
      const payload = {
        subject: formData.title,
        message: formData.description,
        category: formData.category,
        priority: formData.priority,
      };
      const response = await fetch(`${BASE_URL}/tickets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
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

  static async updateTicket(token: string, router: NextRouter, ticketId: string, updates: Partial<Ticket>) {
    try {
      const response = await fetch(`${BASE_URL}/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      if (response.status === 401) {
        handleUnauthorizedError(router);
      }
      return response;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  static async deleteTicket(token: string, router: NextRouter, ticketId: string) {
    try {
      const response = await fetch(`${BASE_URL}/tickets/${ticketId}`, {
        method: "DELETE",
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

  static async updateTicketStatus(token: string, router: NextRouter, ticketId: string, status: TicketStatus) {
    try {
      const response = await fetch(`${BASE_URL}/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (response.status === 401) {
        handleUnauthorizedError(router);
      }

      return response;
    } catch (error) {
      console.error('Error updating ticket status:', error);
      throw error;
    }
  }
}