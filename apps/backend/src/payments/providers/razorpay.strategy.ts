import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import {
  PaymentProviderName,
  PayoutMode,
  PayoutStatus,
} from '../payments.enums';
import {
  PaymentProviderStrategy,
  ProviderCapabilities,
  ProviderPayerStatus,
  ProviderContactResult,
  ProviderInstrumentResult,
  ProviderPayoutInput,
  ProviderPayoutResult,
  ProviderWebhookNormalized,
  BankDetailsInput,
  UpiDetailsInput,
} from './payment-provider.strategy';

@Injectable()
export class RazorpayProviderStrategy implements PaymentProviderStrategy {
  providerName = PaymentProviderName.RAZORPAY;

  private readonly client: AxiosInstance;
  private readonly webhookSecret: string | undefined;
  private readonly supportsUpi: boolean;
  private readonly supportsSubAccounts: boolean;
  private readonly defaultAccountId?: string;

  constructor(private readonly config: ConfigService) {
    const keyId = config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required');
    }

    this.webhookSecret = config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    this.supportsUpi = config.get<string>('RAZORPAY_UPI_PAYOUTS_ENABLED') === 'true';
    this.supportsSubAccounts = config.get<string>('RAZORPAY_SUPPORTS_SUBACCOUNTS') !== 'false';
    this.defaultAccountId = config.get<string>('RAZORPAY_DEFAULT_ACCOUNT_ID');

    this.client = axios.create({
      baseURL: config.get<string>('RAZORPAY_API_BASE', 'https://api.razorpay.com'),
      auth: {
        username: keyId,
        password: keySecret,
      },
      timeout: 15000,
    });
  }

  capabilities(): ProviderCapabilities {
    return {
      bankPayout: true,
      upiPayout: this.supportsUpi,
      supportsIdempotencyKeyHeader: true,
      supportsPayerSubAccounts: this.supportsSubAccounts,
    };
  }

  async createOrGetPayerAccount(payer: { companyName: string; tenantId: string }) {
    if (!this.supportsSubAccounts) {
      if (!this.defaultAccountId) {
        throw new Error('RAZORPAY_DEFAULT_ACCOUNT_ID must be set when subaccounts are disabled');
      }
      return { providerPayerAccountId: this.defaultAccountId };
    }

    const payload = {
      type: 'route',
      legal_business_name: payer.companyName,
      business_type: 'partnership',
      contact_name: payer.companyName,
      reference_id: payer.tenantId,
    };

    const response = await this.client.post('/v2/accounts', payload);
    return { providerPayerAccountId: response.data.id, raw: response.data };
  }

  async getOnboardingLink(providerPayerAccountId: string): Promise<string> {
    const response = await this.client.post(`/v2/accounts/${providerPayerAccountId}/onboarding`, {
      account_id: providerPayerAccountId,
    });
    return response.data?.url || response.data?.short_url || '';
  }

  async refreshPayerStatus(providerPayerAccountId: string): Promise<ProviderPayerStatus> {
    const response = await this.client.get(`/v2/accounts/${providerPayerAccountId}`);
    const status = response.data?.status || 'unknown';
    const kycStatus = status === 'activated' ? 'verified' : status === 'rejected' ? 'rejected' : 'pending';
    const onboardingStatus = status === 'activated' ? 'completed' : status === 'rejected' ? 'failed' : 'in_progress';
    return { kycStatus, onboardingStatus, raw: response.data };
  }

  async createOrGetContact(
    providerPayerAccountId: string,
    recipient: { name: string; email?: string; phone?: string; referenceId?: string },
  ): Promise<ProviderContactResult> {
    const payload: Record<string, any> = {
      name: recipient.name,
      email: recipient.email,
      contact: recipient.phone,
      type: 'employee',
      reference_id: recipient.referenceId,
    };

    const response = await this.client.post('/v1/contacts', payload, {
      headers: this.buildAccountHeader(providerPayerAccountId),
    });

    return { id: response.data.id, raw: response.data };
  }

  async createOrGetBankInstrument(
    providerPayerAccountId: string,
    providerContactId: string,
    bankDetails: BankDetailsInput,
  ): Promise<ProviderInstrumentResult> {
    const payload = {
      contact_id: providerContactId,
      account_type: 'bank_account',
      bank_account: {
        name: bankDetails.name,
        ifsc: bankDetails.ifsc,
        account_number: bankDetails.accountNumber,
      },
    };

    const response = await this.client.post('/v1/fund_accounts', payload, {
      headers: this.buildAccountHeader(providerPayerAccountId),
    });

    return { id: response.data.id, raw: response.data };
  }

  async createOrGetUpiInstrument(
    providerPayerAccountId: string,
    providerContactId: string,
    upiDetails: UpiDetailsInput,
  ): Promise<ProviderInstrumentResult> {
    const payload = {
      contact_id: providerContactId,
      account_type: 'vpa',
      vpa: {
        address: upiDetails.vpa,
        name: upiDetails.name,
      },
    };

    const response = await this.client.post('/v1/fund_accounts', payload, {
      headers: this.buildAccountHeader(providerPayerAccountId),
    });

    return { id: response.data.id, raw: response.data };
  }

  async createPayout(
    providerPayerAccountId: string,
    input: ProviderPayoutInput,
  ): Promise<ProviderPayoutResult> {
    const payload = {
      account_number: input.providerInstrumentId,
      amount: input.amountPaise,
      currency: input.currency,
      mode: this.mapMode(input.mode),
      purpose: input.purpose || 'payout',
      fund_account_id: input.providerInstrumentId,
      notes: input.notes,
      queue_if_low_balance: true,
    };

    const response = await this.client.post('/v1/payouts', payload, {
      headers: {
        ...this.buildAccountHeader(providerPayerAccountId),
        'X-Payout-Idempotency': input.idempotencyKey,
        'X-Idempotency-Key': input.idempotencyKey,
      },
    });

    const status = this.mapPayoutStatus(response.data?.status);
    return { providerPayoutId: response.data.id, status, raw: response.data };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, any>): boolean {
    if (!this.webhookSecret) return false;
    const signature = headers['x-razorpay-signature'] || headers['X-Razorpay-Signature'];
    if (!signature || typeof signature !== 'string') return false;
    const digest = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return digest === signature;
  }

  normalizeWebhook(rawBody: string): ProviderWebhookNormalized | null {
    try {
      const body = JSON.parse(rawBody);
      const payoutEntity = body?.payload?.payout?.entity;
      if (!payoutEntity?.id) return null;
      return {
        providerPayoutId: payoutEntity.id,
        status: this.mapPayoutStatus(payoutEntity.status),
        failureCode: payoutEntity.failure_reason,
        failureMessage: payoutEntity.failure_message,
        occurredAt: payoutEntity.created_at ? new Date(payoutEntity.created_at * 1000) : new Date(),
        raw: body,
      };
    } catch (err) {
      return null;
    }
  }

  private buildAccountHeader(providerPayerAccountId: string) {
    if (!this.supportsSubAccounts) return {};
    return { 'X-Razorpay-Account': providerPayerAccountId };
  }

  private mapMode(mode: PayoutMode): string {
    switch (mode) {
      case PayoutMode.IMPS:
        return 'IMPS';
      case PayoutMode.NEFT:
        return 'NEFT';
      case PayoutMode.RTGS:
        return 'RTGS';
      case PayoutMode.UPI:
        return 'UPI';
      default:
        return 'IMPS';
    }
  }

  private mapPayoutStatus(status: string | undefined): PayoutStatus {
    switch ((status || '').toLowerCase()) {
      case 'processed':
        return PayoutStatus.PROCESSED;
      case 'failed':
        return PayoutStatus.FAILED;
      case 'reversed':
        return PayoutStatus.REVERSED;
      case 'processing':
        return PayoutStatus.SUBMITTED;
      default:
        return PayoutStatus.SUBMITTED;
    }
  }
}
