import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue, Worker, Job } from 'bullmq';
import { Repository } from 'typeorm';
import { Payout } from '../payout.entity';
import { PaymentInstrument } from '../payment-instrument.entity';
import { Recipient } from '../recipient.entity';
import { Payer } from '../payer.entity';
import { PaymentProviderFactory } from '../providers/payment-provider.factory';
import { PayoutMode, PayoutStatus } from '../payments.enums';
import { decrypt } from 'src/helper/encryption';
import { maskProviderResponse } from '../payments.utils';

@Injectable()
export class PayoutQueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private readonly queueName = 'payment-payouts';
  private readonly logger = new Logger(PayoutQueueService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly providerFactory: PaymentProviderFactory,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(PaymentInstrument)
    private readonly instrumentRepository: Repository<PaymentInstrument>,
    @InjectRepository(Recipient)
    private readonly recipientRepository: Repository<Recipient>,
    @InjectRepository(Payer)
    private readonly payerRepository: Repository<Payer>,
  ) {}

  async onModuleInit() {
    const connection = this.getRedisConnection();
    this.queue = new Queue(this.queueName, {
      connection,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.worker = new Worker(
      this.queueName,
      async (job) => this.handleJob(job),
      { connection },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Payout job ${job?.id} failed: ${err?.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }

  async enqueuePayout(payoutId: string) {
    if (!this.queue) return;
    await this.queue.add('payout', { payoutId });
  }

  private async handleJob(job: Job<{ payoutId: string }>) {
    const payout = await this.payoutRepository.findOne({
      where: { id: job.data.payoutId },
      relations: ['payer', 'recipient', 'instrument'],
    });
    if (!payout) return;

    if (payout.providerPayoutId && payout.status === PayoutStatus.SUBMITTED) return;
    if ([PayoutStatus.PROCESSED, PayoutStatus.FAILED, PayoutStatus.REVERSED].includes(payout.status)) return;

    payout.status = PayoutStatus.PROCESSING;
    await this.payoutRepository.save(payout);

    try {
      const payer = payout.payer || (await this.payerRepository.findOne({ where: { id: (payout.payer as any)?.id } }));
      if (!payer?.providerPayerAccountId) {
        throw new Error('Missing provider payer account');
      }
      const provider = this.providerFactory.getProvider(payer.providerName);
      if (payout.mode === PayoutMode.UPI && !provider.capabilities().upiPayout) {
        await this.failPayout(payout, 'CAPABILITY_NOT_SUPPORTED', 'UPI payouts not supported by provider');
        return;
      }

      const recipient = payout.recipient
        ? payout.recipient
        : await this.recipientRepository.findOne({ where: { id: (payout.recipient as any)?.id } });
      if (!recipient) throw new Error('Recipient not found');

      if (!recipient.providerContactId) {
        const contact = await provider.createOrGetContact(payer.providerPayerAccountId, {
          name: recipient.name,
          email: recipient.email,
          phone: recipient.phone,
          referenceId: recipient.id,
        });
        recipient.providerContactId = contact.id;
        await this.recipientRepository.save(recipient);
      }

      const instrument = payout.instrument
        ? payout.instrument
        : await this.instrumentRepository.findOne({ where: { id: (payout.instrument as any)?.id } });
      if (!instrument) throw new Error('Payment instrument not found');

      if (!instrument.providerInstrumentId) {
        const details = JSON.parse(await decrypt(instrument.payloadEnc));
        if (instrument.type === 'bank') {
          const created = await provider.createOrGetBankInstrument(
            payer.providerPayerAccountId,
            recipient.providerContactId!,
            details,
          );
          instrument.providerInstrumentId = created.id;
        } else {
          const created = await provider.createOrGetUpiInstrument(
            payer.providerPayerAccountId,
            recipient.providerContactId!,
            details,
          );
          instrument.providerInstrumentId = created.id;
        }
        await this.instrumentRepository.save(instrument);
      }

      const result = await provider.createPayout(payer.providerPayerAccountId, {
        providerInstrumentId: instrument.providerInstrumentId!,
        amountPaise: payout.amountPaise,
        currency: payout.currency,
        mode: payout.mode,
        purpose: payout.purpose,
        idempotencyKey: payout.idempotencyKey,
        notes: payout.correlationId ? { correlationId: payout.correlationId } : undefined,
      });

      payout.providerPayoutId = result.providerPayoutId;
      payout.status = result.status === PayoutStatus.FAILED ? PayoutStatus.FAILED : PayoutStatus.SUBMITTED;
      payout.rawProviderResponse = maskProviderResponse(result.raw);
      await this.payoutRepository.save(payout);
    } catch (err: any) {
      if (this.isTransientError(err)) {
        throw err;
      }
      await this.failPayout(payout, err?.code, err?.message || 'Payout failed');
    }
  }

  private async failPayout(payout: Payout, failureCode?: string, failureMessage?: string) {
    payout.status = PayoutStatus.FAILED;
    payout.failureCode = failureCode;
    payout.failureMessage = failureMessage;
    await this.payoutRepository.save(payout);
  }

  private isTransientError(err: any) {
    const status = err?.response?.status;
    if (!status) return false;
    return status >= 500 || status === 429;
  }

  private getRedisConnection() {
    return {
      host: this.config.get<string>('REDIS_HOST', '127.0.0.1'),
      port: Number(this.config.get('REDIS_PORT') ?? 6379),
      password: this.config.get<string>('REDIS_PASSWORD'),
      db: Number(this.config.get('REDIS_DB') ?? 0),
    };
  }
}
