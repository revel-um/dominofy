import { PipelineStep } from '../../../../../shared/types/pipelineStepType';
import { DominoExecutable, DominoResult, ExecuteContext } from '../domino-engine.type';
import { PaymentOrchestratorService } from '../../payments/payment-orchestrator.service';
import { PayoutMode } from '../../payments/payments.enums';
import { computeIdempotencyKey } from '../../payments/payments.utils';

export class PaymentBulkPayoutDomino implements DominoExecutable {
  id: string;
  type = 'paymentBulkPayout' as const;

  private literalPayerId: string;
  private literalDefaultMode: PayoutMode;
  private literalDefaultPurpose: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalPayerId = node.data?.payerId?.value ?? '';
    this.literalDefaultMode = node.data?.defaultMode?.value ?? PayoutMode.IMPS;
    this.literalDefaultPurpose = node.data?.defaultPurpose?.value ?? '';
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const tenantId = (ctx.input as any)?.tenantId || (ctx.globals as any)?.tenantId || '';
    const payerId = String((ctx.input as any)?.payerId ?? this.literalPayerId ?? '');
    const defaultMode = ((ctx.input as any)?.defaultMode ?? this.literalDefaultMode ?? PayoutMode.IMPS) as PayoutMode;
    const defaultPurpose = (ctx.input as any)?.defaultPurpose ?? this.literalDefaultPurpose;

    const payoutsInput = (ctx.input as any)?.payouts ?? (Array.isArray(ctx.input) ? ctx.input : []);
    if (!payerId) throw new Error('PaymentBulkPayout: payerId is required');
    if (!Array.isArray(payoutsInput)) throw new Error('PaymentBulkPayout: payouts must be an array');

    const normalized = payoutsInput.map((item: any, idx: number) => {
      const correlationId = item?.correlationId || `row-${idx + 1}`;
      const idempotencyKey = computeIdempotencyKey(
        `${tenantId}|${ctx.runId}|${this.id}|${correlationId}`,
      );
      return {
        recipientId: item.recipientId,
        instrumentId: item.instrumentId,
        amountPaise: Number(item.amountPaise || item.amount || 0),
        mode: (item.mode || defaultMode) as PayoutMode,
        purpose: item.purpose || defaultPurpose,
        correlationId,
        idempotencyKey,
      };
    });

    const batch = await PaymentOrchestratorService.instance.createBulkPayoutBatch(tenantId, payerId, normalized);

    return {
      id: this.id,
      output: {
        batchId: batch.id,
        submittedCount: batch.submittedCount,
        status: batch.status,
      },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
