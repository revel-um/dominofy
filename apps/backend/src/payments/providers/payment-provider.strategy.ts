import { PaymentProviderName, PayoutMode, PayoutStatus } from '../payments.enums';

export interface ProviderCapabilities {
  bankPayout: boolean;
  upiPayout: boolean;
  supportsIdempotencyKeyHeader: boolean;
  supportsPayerSubAccounts: boolean;
}

export interface ProviderPayerStatus {
  kycStatus: string;
  onboardingStatus: string;
  raw?: Record<string, any>;
}

export interface ProviderContactResult {
  id: string;
  raw?: Record<string, any>;
}

export interface ProviderInstrumentResult {
  id: string;
  raw?: Record<string, any>;
}

export interface ProviderPayoutInput {
  providerInstrumentId: string;
  amountPaise: number;
  currency: string;
  mode: PayoutMode;
  purpose?: string;
  idempotencyKey: string;
  notes?: Record<string, any>;
}

export interface ProviderPayoutResult {
  providerPayoutId: string;
  status: PayoutStatus;
  raw?: Record<string, any>;
}

export interface ProviderWebhookNormalized {
  providerPayoutId: string;
  status: PayoutStatus;
  failureCode?: string;
  failureMessage?: string;
  occurredAt?: Date;
  raw: Record<string, any>;
}

export interface BankDetailsInput {
  accountNumber: string;
  ifsc: string;
  name: string;
}

export interface UpiDetailsInput {
  vpa: string;
  name: string;
}

export interface PaymentProviderStrategy {
  providerName: PaymentProviderName;
  capabilities(): ProviderCapabilities;
  createOrGetPayerAccount(payer: { companyName: string; tenantId: string }): Promise<{ providerPayerAccountId: string; raw?: Record<string, any> }>;
  getOnboardingLink(providerPayerAccountId: string): Promise<string>;
  refreshPayerStatus(providerPayerAccountId: string): Promise<ProviderPayerStatus>;
  createOrGetContact(providerPayerAccountId: string, recipient: { name: string; email?: string; phone?: string; referenceId?: string }): Promise<ProviderContactResult>;
  createOrGetBankInstrument(
    providerPayerAccountId: string,
    providerContactId: string,
    bankDetails: BankDetailsInput,
  ): Promise<ProviderInstrumentResult>;
  createOrGetUpiInstrument(
    providerPayerAccountId: string,
    providerContactId: string,
    upiDetails: UpiDetailsInput,
  ): Promise<ProviderInstrumentResult>;
  createPayout(
    providerPayerAccountId: string,
    input: ProviderPayoutInput,
  ): Promise<ProviderPayoutResult>;
  verifyWebhookSignature(rawBody: string, headers: Record<string, any>): boolean;
  normalizeWebhook(rawBody: string): ProviderWebhookNormalized | null;
}
