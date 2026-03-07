import { NextRouter } from 'next/router';
import { handleServerError } from '@/utils/error.handler';
import { config } from '@/config/config';
import { authFetch } from '@/utils/authFetch';

export interface PayerStatus {
  id: string;
  providerName: string;
  kycStatus: string;
  onboardingStatus: string;
  providerPayerAccountId?: string;
  companyName?: string;
}

export interface Recipient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  providerContactId?: string;
}

export interface PaymentInstrument {
  id: string;
  type: 'bank' | 'upi';
  bankLast4?: string;
  bankIfsc?: string;
  upiVpaHash?: string;
  holderName?: string;
  providerInstrumentId?: string;
}

export interface Payout {
  id: string;
  status: string;
  amountPaise: number;
  mode: string;
  purpose?: string;
  correlationId?: string;
}

export interface PayoutBatch {
  id: string;
  status: string;
  totalCount: number;
  processedCount: number;
  failedCount: number;
  submittedCount: number;
}

export class PaymentsApi {
  static async listPayers(token: string, router: NextRouter) {
    try {
      const res = await authFetch(`${config.backendBaseUrl}/payments/payers`, { token }, router);
      if (!res.ok) return [] as PayerStatus[];
      return (await res.json()) as PayerStatus[];
    } catch (err) {
      handleServerError(router, err);
      return [] as PayerStatus[];
    }
  }
  static async connectProvider(
    token: string,
    router: NextRouter,
    payload: { providerName: string; companyName: string },
  ) {
    try {
      const res = await authFetch(`${config.backendBaseUrl}/payments/payers/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        token,
      }, router);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (err) {
      handleServerError(router, err);
      return null;
    }
  }

  static async getPayerStatus(token: string, router: NextRouter, payerId: string, refresh = false) {
    try {
      const res = await authFetch(
        `${config.backendBaseUrl}/payments/payers/${payerId}/status?refresh=${refresh}`,
        { token },
        router,
      );
      if (!res.ok) return null;
      return (await res.json()) as PayerStatus;
    } catch (err) {
      handleServerError(router, err);
      return null;
    }
  }

  static async listRecipients(token: string, router: NextRouter, payerId: string) {
    try {
      const res = await authFetch(
        `${config.backendBaseUrl}/payments/payers/${payerId}/recipients`,
        { token },
        router,
      );
      if (!res.ok) return [] as Recipient[];
      return (await res.json()) as Recipient[];
    } catch (err) {
      handleServerError(router, err);
      return [] as Recipient[];
    }
  }

  static async createRecipient(
    token: string,
    router: NextRouter,
    payerId: string,
    payload: { name: string; email?: string; phone?: string },
  ) {
    try {
      const res = await authFetch(
        `${config.backendBaseUrl}/payments/payers/${payerId}/recipients`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          token,
        },
        router,
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      return (await res.json()) as Recipient;
    } catch (err) {
      handleServerError(router, err);
      return null;
    }
  }

  static async listInstruments(token: string, router: NextRouter, payerId: string, recipientId: string) {
    try {
      const res = await authFetch(
        `${config.backendBaseUrl}/payments/payers/${payerId}/recipients/${recipientId}/instruments`,
        { token },
        router,
      );
      if (!res.ok) return [] as PaymentInstrument[];
      return (await res.json()) as PaymentInstrument[];
    } catch (err) {
      handleServerError(router, err);
      return [] as PaymentInstrument[];
    }
  }

  static async addBankInstrument(
    token: string,
    router: NextRouter,
    payerId: string,
    recipientId: string,
    payload: { accountNumber: string; ifsc: string; name: string },
  ) {
    try {
      const res = await authFetch(
        `${config.backendBaseUrl}/payments/payers/${payerId}/recipients/${recipientId}/instruments/bank`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          token,
        },
        router,
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      return (await res.json()) as PaymentInstrument;
    } catch (err) {
      handleServerError(router, err);
      return null;
    }
  }

  static async addUpiInstrument(
    token: string,
    router: NextRouter,
    payerId: string,
    recipientId: string,
    payload: { vpa: string; name: string },
  ) {
    try {
      const res = await authFetch(
        `${config.backendBaseUrl}/payments/payers/${payerId}/recipients/${recipientId}/instruments/upi`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          token,
        },
        router,
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      return (await res.json()) as PaymentInstrument;
    } catch (err) {
      handleServerError(router, err);
      return null;
    }
  }

  static async listPayouts(token: string, router: NextRouter, limit = 50, offset = 0) {
    try {
      const res = await authFetch(
        `${config.backendBaseUrl}/payments/payouts?limit=${limit}&offset=${offset}`,
        { token },
        router,
      );
      if (!res.ok) return { items: [], count: 0 } as { items: Payout[]; count: number };
      return (await res.json()) as { items: Payout[]; count: number };
    } catch (err) {
      handleServerError(router, err);
      return { items: [], count: 0 } as { items: Payout[]; count: number };
    }
  }

  static async listBatches(token: string, router: NextRouter, limit = 50, offset = 0) {
    try {
      const res = await authFetch(
        `${config.backendBaseUrl}/payments/payout-batches?limit=${limit}&offset=${offset}`,
        { token },
        router,
      );
      if (!res.ok) return { items: [], count: 0 } as { items: PayoutBatch[]; count: number };
      return (await res.json()) as { items: PayoutBatch[]; count: number };
    } catch (err) {
      handleServerError(router, err);
      return { items: [], count: 0 } as { items: PayoutBatch[]; count: number };
    }
  }

  static async getBatch(token: string, router: NextRouter, batchId: string) {
    try {
      const res = await authFetch(
        `${config.backendBaseUrl}/payments/payout-batches/${batchId}`,
        { token },
        router,
      );
      if (!res.ok) return null;
      return (await res.json()) as any;
    } catch (err) {
      handleServerError(router, err);
      return null;
    }
  }

  static async retryFailed(token: string, router: NextRouter, batchId: string) {
    try {
      const res = await authFetch(
        `${config.backendBaseUrl}/payments/payout-batches/${batchId}/retry-failed`,
        { method: 'POST', token },
        router,
      );
      if (!res.ok) return null;
      return res.json();
    } catch (err) {
      handleServerError(router, err);
      return null;
    }
  }
}
