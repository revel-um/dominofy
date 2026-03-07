import { PipelineStep } from '../../../../../shared/types/pipelineStepType';
import { DominoExecutable, DominoResult, ExecuteContext } from '../domino-engine.type';
import { PaymentOrchestratorService } from '../../payments/payment-orchestrator.service';

export class PaymentAddUpiInstrumentDomino implements DominoExecutable {
  id: string;
  type = 'paymentAddUpiInstrument' as const;

  private literalPayerId: string;
  private literalRecipientId: string;
  private literalVpa: string;
  private literalName: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalPayerId = node.data?.payerId?.value ?? '';
    this.literalRecipientId = node.data?.recipientId?.value ?? '';
    this.literalVpa = node.data?.vpa?.value ?? '';
    this.literalName = node.data?.name?.value ?? '';
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const payerId = String((ctx.input as any)?.payerId ?? this.literalPayerId ?? '');
    const recipientId = String((ctx.input as any)?.recipientId ?? this.literalRecipientId ?? '');
    const vpa = String((ctx.input as any)?.vpa ?? this.literalVpa ?? '');
    const name = String((ctx.input as any)?.name ?? this.literalName ?? '');

    if (!payerId) throw new Error('PaymentAddUpiInstrument: payerId is required');
    if (!recipientId) throw new Error('PaymentAddUpiInstrument: recipientId is required');
    if (!vpa) throw new Error('PaymentAddUpiInstrument: vpa is required');

    const tenantId = (ctx.input as any)?.tenantId || (ctx.globals as any)?.tenantId || '';

    const instrument = await PaymentOrchestratorService.instance.addUpiInstrument(tenantId, payerId, recipientId, {
      vpa,
      name,
    });

    return {
      id: this.id,
      output: { instrumentId: instrument.id },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
