import { PipelineStep } from '../../../../../shared/types/pipelineStepType';
import { DominoExecutable, DominoResult, ExecuteContext } from '../domino-engine.type';
import { PaymentOrchestratorService } from '../../payments/payment-orchestrator.service';
import { PayoutMode } from '../../payments/payments.enums';
import { computeIdempotencyKey } from '../../payments/payments.utils';

export class PaymentSinglePayoutDomino implements DominoExecutable {
  id: string;
  type = 'paymentSinglePayout' as const;

  private literalPayerId: string;
  private literalRecipientId: string;
  private literalInstrumentId: string;
  private literalAmount: number;
  private literalMode: PayoutMode;
  private literalPurpose: string;
  private literalCorrelationId: string;
  private literalAccountNumber: string;
  private literalIfsc: string;
  private literalName: string;
  private literalVpa: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalPayerId = node.data?.payerId?.value ?? '';
    this.literalRecipientId = node.data?.recipientId?.value ?? '';
    this.literalInstrumentId = node.data?.instrumentId?.value ?? '';
    this.literalAmount = Number(node.data?.amountPaise?.value ?? 0);
    this.literalMode = node.data?.mode?.value ?? PayoutMode.IMPS;
    this.literalPurpose = node.data?.purpose?.value ?? '';
    this.literalCorrelationId = node.data?.correlationId?.value ?? '';
    this.literalAccountNumber = node.data?.accountNumber?.value ?? '';
    this.literalIfsc = node.data?.ifsc?.value ?? '';
    this.literalName = node.data?.name?.value ?? '';
    this.literalVpa = node.data?.vpa?.value ?? '';
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const payerId = String((ctx.input as any)?.payerId ?? this.literalPayerId ?? '');
    const recipientId = String((ctx.input as any)?.recipientId ?? this.literalRecipientId ?? '');
    let instrumentId = String((ctx.input as any)?.instrumentId ?? this.literalInstrumentId ?? '');
    const amountPaise = Number((ctx.input as any)?.amountPaise ?? this.literalAmount ?? 0);
    const mode = ((ctx.input as any)?.mode ?? this.literalMode ?? PayoutMode.IMPS) as PayoutMode;
    const purpose = (ctx.input as any)?.purpose ?? this.literalPurpose;
    const correlationId = (ctx.input as any)?.correlationId ?? this.literalCorrelationId;
    const accountNumber = String((ctx.input as any)?.accountNumber ?? this.literalAccountNumber ?? '');
    const ifsc = String((ctx.input as any)?.ifsc ?? this.literalIfsc ?? '');
    const name = String((ctx.input as any)?.name ?? this.literalName ?? '');
    const vpa = String((ctx.input as any)?.vpa ?? this.literalVpa ?? '');

    if (!payerId) throw new Error('PaymentSinglePayout: payerId is required');
    if (!recipientId) throw new Error('PaymentSinglePayout: recipientId is required');
    if (!amountPaise) throw new Error('PaymentSinglePayout: amountPaise is required');

    const tenantId = (ctx.input as any)?.tenantId || (ctx.globals as any)?.tenantId || '';
    const idempotencyKey = computeIdempotencyKey(`${tenantId}|${ctx.runId}|${this.id}|${correlationId || 'single'}`);

    if (!instrumentId) {
      if (accountNumber && ifsc) {
        const instrument = await PaymentOrchestratorService.instance.addBankInstrument(tenantId, payerId, recipientId, {
          accountNumber,
          ifsc,
          name: name || 'Recipient',
        });
        instrumentId = instrument.id;
      } else if (vpa) {
        const instrument = await PaymentOrchestratorService.instance.addUpiInstrument(tenantId, payerId, recipientId, {
          vpa,
          name: name || 'Recipient',
        });
        instrumentId = instrument.id;
      }
    }

    if (!instrumentId) throw new Error('PaymentSinglePayout: instrumentId or instrument details are required');

    const payout = await PaymentOrchestratorService.instance.createSinglePayout(tenantId, payerId, {
      recipientId,
      instrumentId,
      amountPaise,
      mode,
      purpose,
      correlationId,
      idempotencyKey,
    });

    return {
      id: this.id,
      output: { payoutId: payout.id, status: payout.status },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
