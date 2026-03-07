import { PipelineStep } from '../../../../../shared/types/pipelineStepType';
import { DominoExecutable, DominoResult, ExecuteContext } from '../domino-engine.type';
import { PaymentOrchestratorService } from '../../payments/payment-orchestrator.service';

export class PaymentAddBankInstrumentDomino implements DominoExecutable {
  id: string;
  type = 'paymentAddBankInstrument' as const;

  private literalPayerId: string;
  private literalRecipientId: string;
  private literalAccountNumber: string;
  private literalIfsc: string;
  private literalName: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalPayerId = node.data?.payerId?.value ?? '';
    this.literalRecipientId = node.data?.recipientId?.value ?? '';
    this.literalAccountNumber = node.data?.accountNumber?.value ?? '';
    this.literalIfsc = node.data?.ifsc?.value ?? '';
    this.literalName = node.data?.name?.value ?? '';
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const payerId = String((ctx.input as any)?.payerId ?? this.literalPayerId ?? '');
    const recipientId = String((ctx.input as any)?.recipientId ?? this.literalRecipientId ?? '');
    const accountNumber = String((ctx.input as any)?.accountNumber ?? this.literalAccountNumber ?? '');
    const ifsc = String((ctx.input as any)?.ifsc ?? this.literalIfsc ?? '');
    const name = String((ctx.input as any)?.name ?? this.literalName ?? '');

    if (!payerId) throw new Error('PaymentAddBankInstrument: payerId is required');
    if (!recipientId) throw new Error('PaymentAddBankInstrument: recipientId is required');
    if (!accountNumber) throw new Error('PaymentAddBankInstrument: accountNumber is required');
    if (!ifsc) throw new Error('PaymentAddBankInstrument: ifsc is required');

    const tenantId = (ctx.input as any)?.tenantId || (ctx.globals as any)?.tenantId || '';

    const instrument = await PaymentOrchestratorService.instance.addBankInstrument(tenantId, payerId, recipientId, {
      accountNumber,
      ifsc,
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
