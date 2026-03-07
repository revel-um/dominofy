import { PipelineStep } from '../../../../../shared/types/pipelineStepType';
import { DominoExecutable, DominoResult, ExecuteContext } from '../domino-engine.type';
import { PaymentOrchestratorService } from '../../payments/payment-orchestrator.service';
import { PayoutBatchStatus, PayoutStatus } from '../../payments/payments.enums';

export class PaymentWaitForCompletionDomino implements DominoExecutable {
  id: string;
  type = 'paymentWaitForCompletion' as const;

  private literalPayoutId: string;
  private literalBatchId: string;
  private literalPollInterval: number;
  private literalTimeout: number;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalPayoutId = node.data?.payoutId?.value ?? '';
    this.literalBatchId = node.data?.batchId?.value ?? '';
    this.literalPollInterval = Number(node.data?.pollIntervalSeconds?.value ?? 5);
    this.literalTimeout = Number(node.data?.timeoutSeconds?.value ?? 120);
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const tenantId = (ctx.input as any)?.tenantId || (ctx.globals as any)?.tenantId || '';
    const payoutId = String((ctx.input as any)?.payoutId ?? this.literalPayoutId ?? '');
    const batchId = String((ctx.input as any)?.batchId ?? this.literalBatchId ?? '');
    const pollInterval = Number((ctx.input as any)?.pollIntervalSeconds ?? this.literalPollInterval ?? 5) * 1000;
    const timeout = Number((ctx.input as any)?.timeoutSeconds ?? this.literalTimeout ?? 120) * 1000;

    if (!payoutId && !batchId) throw new Error('PaymentWaitForCompletion: payoutId or batchId required');

    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if (ctx.abortSignal?.aborted) break;

      if (payoutId) {
        const payout = await PaymentOrchestratorService.instance.getPayout(tenantId, payoutId);
        if (this.isPayoutTerminal(payout.status)) {
          return {
            id: this.id,
            output: { payoutId, status: payout.status, failureMessage: payout.failureMessage },
            startedAt,
            finishedAt: Date.now(),
          };
        }
      }

      if (batchId) {
        const batch = await PaymentOrchestratorService.instance.getBatch(tenantId, batchId);
        if (this.isBatchTerminal(batch.status)) {
          return {
            id: this.id,
            output: { batchId, status: batch.status, processedCount: batch.processedCount, failedCount: batch.failedCount },
            startedAt,
            finishedAt: Date.now(),
          };
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return {
      id: this.id,
      output: { payoutId, batchId, status: 'timeout' },
      startedAt,
      finishedAt: Date.now(),
    };
  }

  private isPayoutTerminal(status: PayoutStatus) {
    return [PayoutStatus.PROCESSED, PayoutStatus.FAILED, PayoutStatus.REVERSED].includes(status);
  }

  private isBatchTerminal(status: PayoutBatchStatus) {
    return [PayoutBatchStatus.SUCCESS, PayoutBatchStatus.FAILED, PayoutBatchStatus.PARTIAL].includes(status);
  }
}
