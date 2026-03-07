import { PipelineStep } from '../../../../../shared/types/pipelineStepType';
import { DominoExecutable, DominoResult, ExecuteContext } from '../domino-engine.type';
import { PaymentOrchestratorService } from '../../payments/payment-orchestrator.service';

export class PaymentCreateRecipientDomino implements DominoExecutable {
  id: string;
  type = 'paymentCreateRecipient' as const;

  private literalPayerId: string;
  private literalName: string;
  private literalEmail: string;
  private literalPhone: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalPayerId = node.data?.payerId?.value ?? '';
    this.literalName = node.data?.recipientName?.value ?? '';
    this.literalEmail = node.data?.recipientEmail?.value ?? '';
    this.literalPhone = node.data?.recipientPhone?.value ?? '';
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const payerId = String((ctx.input as any)?.payerId ?? this.literalPayerId ?? '');
    const name = String((ctx.input as any)?.recipientName ?? this.literalName ?? '');
    const email = (ctx.input as any)?.recipientEmail ?? this.literalEmail;
    const phone = (ctx.input as any)?.recipientPhone ?? this.literalPhone;

    if (!payerId) throw new Error('PaymentCreateRecipient: payerId is required');
    if (!name) throw new Error('PaymentCreateRecipient: recipientName is required');

    const recipient = await PaymentOrchestratorService.instance.createRecipient(
      (ctx.input as any)?.tenantId || (ctx.globals as any)?.tenantId || '',
      payerId,
      { name, email, phone },
    );

    return {
      id: this.id,
      output: { recipientId: recipient.id },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
