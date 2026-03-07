import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { encrypt, decrypt } from 'src/helper/encryption';
import { v4 as uuidv4 } from 'uuid';
import { Payer } from './payer.entity';
import { Recipient } from './recipient.entity';
import { PaymentInstrument } from './payment-instrument.entity';
import { Payout } from './payout.entity';
import { PayoutBatch } from './payout-batch.entity';
import { WebhookEvent } from './webhook-event.entity';
import {
  PaymentProviderName,
  PaymentInstrumentType,
  PayoutBatchStatus,
  PayoutMode,
  PayoutStatus,
  PayerKycStatus,
  PayerOnboardingStatus,
} from './payments.enums';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PayoutQueueService } from './worker/payout-queue.service';
import {
  fingerprintBank,
  fingerprintUpi,
  maskProviderResponse,
  assertUpiCapability,
  deriveBatchStatus,
  isTerminalPayoutStatus,
} from './payments.utils';
import { BankDetailsInput, UpiDetailsInput } from './providers/payment-provider.strategy';

interface CreatePayoutInput {
  recipientId: string;
  instrumentId: string;
  amountPaise: number;
  mode: PayoutMode;
  purpose?: string;
  correlationId?: string;
  idempotencyKey?: string;
  currency?: string;
  notes?: Record<string, any>;
}

@Injectable()
export class PaymentOrchestratorService implements OnModuleInit {
  private static _instance: PaymentOrchestratorService | null = null;

  constructor(
    @InjectRepository(Payer)
    private readonly payerRepository: Repository<Payer>,
    @InjectRepository(Recipient)
    private readonly recipientRepository: Repository<Recipient>,
    @InjectRepository(PaymentInstrument)
    private readonly instrumentRepository: Repository<PaymentInstrument>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(PayoutBatch)
    private readonly batchRepository: Repository<PayoutBatch>,
    @InjectRepository(WebhookEvent)
    private readonly webhookRepository: Repository<WebhookEvent>,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly payoutQueue: PayoutQueueService,
  ) {}

  static get instance(): PaymentOrchestratorService {
    if (!this._instance) {
      throw new Error('PaymentOrchestratorService not initialized');
    }
    return this._instance;
  }

  onModuleInit() {
    PaymentOrchestratorService._instance = this;
  }

  async connectPayerProvider(tenantId: string, providerName: PaymentProviderName, companyName: string) {
    const provider = this.providerFactory.getProvider(providerName);
    const payerAccount = await provider.createOrGetPayerAccount({ tenantId, companyName });

    const payer = this.payerRepository.create({
      tenantId,
      providerName,
      providerPayerAccountId: payerAccount.providerPayerAccountId,
      companyName,
      onboardingStatus: PayerOnboardingStatus.IN_PROGRESS,
      kycStatus: PayerKycStatus.PENDING,
      providerMetadata: payerAccount.raw,
    });
    const saved = await this.payerRepository.save(payer);

    const onboardingUrl = await provider.getOnboardingLink(saved.providerPayerAccountId!);
    return { payerId: saved.id, onboardingUrl };
  }

  async getPayerProviderStatus(tenantId: string, payerId: string, refresh: boolean) {
    const payer = await this.payerRepository.findOne({ where: { id: payerId, tenantId } });
    if (!payer) throw new NotFoundException('Payer not found');
    if (!refresh) return payer;

    const provider = this.providerFactory.getProvider(payer.providerName);
    const status = await provider.refreshPayerStatus(payer.providerPayerAccountId!);
    payer.kycStatus = this.mapKycStatus(status.kycStatus);
    payer.onboardingStatus = this.mapOnboardingStatus(status.onboardingStatus);
    payer.providerMetadata = status.raw || payer.providerMetadata;
    return this.payerRepository.save(payer);
  }

  async createRecipient(tenantId: string, payerId: string, dto: { name: string; email?: string; phone?: string }) {
    const payer = await this.ensurePayer(tenantId, payerId);
    const recipient = this.recipientRepository.create({
      tenantId,
      payer,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
    });
    return this.recipientRepository.save(recipient);
  }

  async addBankInstrument(
    tenantId: string,
    payerId: string,
    recipientId: string,
    bankDetails: BankDetailsInput,
  ) {
    const payer = await this.ensurePayer(tenantId, payerId);
    const recipient = await this.ensureRecipient(tenantId, payerId, recipientId);
    const fingerprint = fingerprintBank(bankDetails.accountNumber, bankDetails.ifsc, bankDetails.name);

    const existing = await this.instrumentRepository.findOne({
      where: {
        tenantId,
        payer: { id: payerId } as any,
        recipient: { id: recipientId } as any,
        type: PaymentInstrumentType.BANK,
        fingerprint,
      },
      relations: ['payer', 'recipient'],
    });
    if (existing) return existing;

    const provider = this.providerFactory.getProvider(payer.providerName);
    const contactId = await this.ensureProviderContact(payer, recipient);
    const providerInstrument = await provider.createOrGetBankInstrument(
      payer.providerPayerAccountId!,
      contactId,
      bankDetails,
    );

    const payloadEnc = await encrypt(JSON.stringify({
      accountNumber: bankDetails.accountNumber,
      ifsc: bankDetails.ifsc,
      name: bankDetails.name,
    }));

    const instrument = this.instrumentRepository.create({
      tenantId,
      payer,
      recipient,
      type: PaymentInstrumentType.BANK,
      payloadEnc,
      bankLast4: bankDetails.accountNumber.slice(-4),
      bankIfsc: bankDetails.ifsc.toUpperCase(),
      holderName: bankDetails.name,
      providerInstrumentId: providerInstrument.id,
      fingerprint,
    });

    return this.instrumentRepository.save(instrument);
  }

  async addUpiInstrument(
    tenantId: string,
    payerId: string,
    recipientId: string,
    upiDetails: UpiDetailsInput,
  ) {
    const payer = await this.ensurePayer(tenantId, payerId);
    const recipient = await this.ensureRecipient(tenantId, payerId, recipientId);
    const fingerprint = fingerprintUpi(upiDetails.vpa, upiDetails.name);

    const existing = await this.instrumentRepository.findOne({
      where: {
        tenantId,
        payer: { id: payerId } as any,
        recipient: { id: recipientId } as any,
        type: PaymentInstrumentType.UPI,
        fingerprint,
      },
      relations: ['payer', 'recipient'],
    });
    if (existing) return existing;

    const provider = this.providerFactory.getProvider(payer.providerName);
    this.ensureCapability(provider, PayoutMode.UPI);

    const contactId = await this.ensureProviderContact(payer, recipient);
    const providerInstrument = await provider.createOrGetUpiInstrument(
      payer.providerPayerAccountId!,
      contactId,
      upiDetails,
    );

    const payloadEnc = await encrypt(JSON.stringify({
      vpa: upiDetails.vpa,
      name: upiDetails.name,
    }));

    const instrument = this.instrumentRepository.create({
      tenantId,
      payer,
      recipient,
      type: PaymentInstrumentType.UPI,
      payloadEnc,
      upiVpaHash: fingerprint,
      holderName: upiDetails.name,
      providerInstrumentId: providerInstrument.id,
      fingerprint,
    });

    return this.instrumentRepository.save(instrument);
  }

  async createSinglePayout(tenantId: string, payerId: string, input: CreatePayoutInput) {
    const payer = await this.ensurePayerReady(tenantId, payerId);
    const provider = this.providerFactory.getProvider(payer.providerName);
    this.ensureCapability(provider, input.mode);

    const instrument = await this.ensureInstrument(tenantId, payerId, input.instrumentId);
    const recipient = await this.ensureRecipient(tenantId, payerId, input.recipientId);

    const idempotencyKey = input.idempotencyKey || uuidv4();
    const existing = await this.payoutRepository.findOne({ where: { idempotencyKey } });
    if (existing) return existing;

    const payout = this.payoutRepository.create({
      tenantId,
      payer,
      recipient,
      instrument,
      providerName: payer.providerName,
      mode: input.mode,
      amountPaise: input.amountPaise,
      currency: input.currency || 'INR',
      purpose: input.purpose,
      idempotencyKey,
      status: PayoutStatus.QUEUED,
      correlationId: input.correlationId,
    });

    const saved = await this.payoutRepository.save(payout);
    await this.payoutQueue.enqueuePayout(saved.id);
    return saved;
  }

  async createBulkPayoutBatch(tenantId: string, payerId: string, payouts: CreatePayoutInput[]) {
    const payer = await this.ensurePayerReady(tenantId, payerId);
    const provider = this.providerFactory.getProvider(payer.providerName);

    const batch = this.batchRepository.create({
      tenantId,
      payer,
      status: PayoutBatchStatus.QUEUED,
      totalCount: payouts.length,
    });
    const savedBatch = await this.batchRepository.save(batch);

    let submittedCount = 0;

    for (const item of payouts) {
      this.ensureCapability(provider, item.mode);
      const payout = await this.createSinglePayout(tenantId, payerId, {
        ...item,
        idempotencyKey: item.idempotencyKey || uuidv4(),
      });
      if (!payout.batch) {
        payout.batch = savedBatch;
        await this.payoutRepository.save(payout);
        submittedCount += 1;
      }
    }

    savedBatch.submittedCount = submittedCount;
    await this.batchRepository.save(savedBatch);
    return savedBatch;
  }

  async getPayout(tenantId: string, payoutId: string) {
    const payout = await this.payoutRepository.findOne({
      where: { id: payoutId, tenantId },
      relations: ['payer', 'recipient', 'instrument', 'batch'],
    });
    if (!payout) throw new NotFoundException('Payout not found');
    return payout;
  }

  async getBatch(tenantId: string, batchId: string) {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId, tenantId },
      relations: ['payer', 'payouts'],
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async listPayouts(tenantId: string, limit = 50, offset = 0) {
    return this.payoutRepository.findAndCount({
      where: { tenantId },
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
      relations: ['payer', 'recipient', 'instrument', 'batch'],
    });
  }

  async listBatches(tenantId: string, limit = 50, offset = 0) {
    return this.batchRepository.findAndCount({
      where: { tenantId },
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });
  }

  async listPayers(tenantId: string) {
    return this.payerRepository.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async listRecipients(tenantId: string, payerId: string) {
    await this.ensurePayer(tenantId, payerId);
    return this.recipientRepository.find({ where: { tenantId, payer: { id: payerId } as any } });
  }

  async listInstruments(tenantId: string, payerId: string, recipientId: string) {
    await this.ensureRecipient(tenantId, payerId, recipientId);
    return this.instrumentRepository.find({
      where: { tenantId, payer: { id: payerId } as any, recipient: { id: recipientId } as any },
    });
  }

  async retryFailedPayouts(tenantId: string, batchId: string) {
    const batch = await this.getBatch(tenantId, batchId);
    const failed = (batch.payouts || []).filter((p) => p.status === PayoutStatus.FAILED);

    const newPayouts: Payout[] = [];
    for (const payout of failed) {
      const clone = this.payoutRepository.create({
        tenantId,
        payer: payout.payer,
        recipient: payout.recipient,
        instrument: payout.instrument,
        providerName: payout.providerName,
        mode: payout.mode,
        amountPaise: payout.amountPaise,
        currency: payout.currency,
        purpose: payout.purpose,
        idempotencyKey: uuidv4(),
        status: PayoutStatus.QUEUED,
        correlationId: payout.correlationId,
        batch,
      });
      const saved = await this.payoutRepository.save(clone);
      await this.payoutQueue.enqueuePayout(saved.id);
      newPayouts.push(saved);
    }

    return { retriedCount: newPayouts.length, payouts: newPayouts };
  }

  async storeWebhookEvent(event: WebhookEvent) {
    return this.webhookRepository.save(event);
  }

  async updatePayoutFromWebhook(normalized: {
    providerPayoutId: string;
    status: PayoutStatus;
    failureCode?: string;
    failureMessage?: string;
    raw: Record<string, any>;
  }) {
    const payout = await this.payoutRepository.findOne({
      where: { providerPayoutId: normalized.providerPayoutId },
      relations: ['batch'],
    });
    if (!payout) return null;

    if (isTerminalPayoutStatus(payout.status)) {
      return payout;
    }

    payout.status = normalized.status;
    payout.failureCode = normalized.failureCode;
    payout.failureMessage = normalized.failureMessage;
    payout.rawProviderResponse = maskProviderResponse(normalized.raw);
    const saved = await this.payoutRepository.save(payout);

    if (saved.batch) {
      await this.recomputeBatchStatus(saved.batch.id);
    }

    return saved;
  }

  async recomputeBatchStatus(batchId: string) {
    const payouts = await this.payoutRepository.find({
      where: { batch: { id: batchId } as any },
    });

    if (!payouts.length) return null;

    const processed = payouts.filter((p) => p.status === PayoutStatus.PROCESSED).length;
    const failed = payouts.filter((p) => [PayoutStatus.FAILED, PayoutStatus.REVERSED].includes(p.status)).length;
    const submitted = payouts.filter((p) => p.status === PayoutStatus.SUBMITTED).length;
    const processing = payouts.filter((p) => p.status === PayoutStatus.PROCESSING).length;

    const status = deriveBatchStatus(payouts.map((p) => p.status)) as PayoutBatchStatus;

    const batch = await this.batchRepository.findOne({ where: { id: batchId } });
    if (!batch) return null;
    batch.processedCount = processed;
    batch.failedCount = failed;
    batch.submittedCount = submitted + processing;
    batch.status = status;
    return this.batchRepository.save(batch);
  }

  async ensureProviderContact(payer: Payer, recipient: Recipient) {
    if (recipient.providerContactId) return recipient.providerContactId;
    const provider = this.providerFactory.getProvider(payer.providerName);
    const contact = await provider.createOrGetContact(payer.providerPayerAccountId!, {
      name: recipient.name,
      email: recipient.email,
      phone: recipient.phone,
      referenceId: recipient.id,
    });
    recipient.providerContactId = contact.id;
    await this.recipientRepository.save(recipient);
    return contact.id;
  }

  async ensureInstrument(tenantId: string, payerId: string, instrumentId: string) {
    const instrument = await this.instrumentRepository.findOne({
      where: { id: instrumentId, tenantId, payer: { id: payerId } as any },
      relations: ['recipient', 'payer'],
    });
    if (!instrument) throw new NotFoundException('Payment instrument not found');
    return instrument;
  }

  async ensureRecipient(tenantId: string, payerId: string, recipientId: string) {
    const recipient = await this.recipientRepository.findOne({
      where: { id: recipientId, tenantId, payer: { id: payerId } as any },
      relations: ['payer'],
    });
    if (!recipient) throw new NotFoundException('Recipient not found');
    return recipient;
  }

  async ensurePayer(tenantId: string, payerId: string) {
    const payer = await this.payerRepository.findOne({ where: { id: payerId, tenantId } });
    if (!payer) throw new NotFoundException('Payer not found');
    return payer;
  }

  async ensurePayerReady(tenantId: string, payerId: string) {
    const payer = await this.ensurePayer(tenantId, payerId);
    if (payer.kycStatus !== PayerKycStatus.VERIFIED || payer.onboardingStatus !== PayerOnboardingStatus.COMPLETED) {
      throw new BadRequestException('PAYER_NOT_READY');
    }
    return payer;
  }

  async resolveInstrumentDetails(instrument: PaymentInstrument) {
    const decrypted = JSON.parse(await decrypt(instrument.payloadEnc));
    return decrypted as BankDetailsInput | UpiDetailsInput;
  }

  ensureCapability(provider: { capabilities: () => { upiPayout: boolean } }, mode: PayoutMode) {
    if (mode === PayoutMode.UPI && !provider.capabilities().upiPayout) {
      try {
        assertUpiCapability(provider.capabilities().upiPayout);
      } catch (err) {
        throw new BadRequestException('CAPABILITY_NOT_SUPPORTED');
      }
    }
  }

  private mapKycStatus(status: string): PayerKycStatus {
    switch (status) {
      case 'verified':
        return PayerKycStatus.VERIFIED;
      case 'rejected':
        return PayerKycStatus.REJECTED;
      case 'pending':
      default:
        return PayerKycStatus.PENDING;
    }
  }

  private mapOnboardingStatus(status: string): PayerOnboardingStatus {
    switch (status) {
      case 'completed':
        return PayerOnboardingStatus.COMPLETED;
      case 'failed':
        return PayerOnboardingStatus.FAILED;
      case 'in_progress':
      default:
        return PayerOnboardingStatus.IN_PROGRESS;
    }
  }

}
