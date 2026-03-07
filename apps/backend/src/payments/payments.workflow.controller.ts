import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  WorkflowBulkPayoutRequestDto,
  WorkflowPayoutRequestDto,
} from './payments.dto';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { computeIdempotencyKey } from './payments.utils';
import { PayoutMode } from './payments.enums';

@Controller({ path: 'workflow/payments', version: '1' })
export class PaymentsWorkflowController {
  constructor(private readonly payments: PaymentOrchestratorService) {}

  @Post('payout')
  async createWorkflowPayout(@Body() dto: WorkflowPayoutRequestDto, @Req() req: Request) {
    const tenantId = (req as any).user?.id;

    const idempotencyKey = this.buildIdempotencyKey(
      tenantId,
      dto.payerId,
      dto.workflowRunId,
      dto.stepId,
      dto.correlationId || 'single',
    );

    const recipientId = dto.recipientId || (await this.resolveRecipient(tenantId, dto.payerId, {
      name: dto.recipientName || dto.bankDetails?.name || dto.upiDetails?.name || 'Recipient',
      email: dto.recipientEmail,
      phone: dto.recipientPhone,
    })).id;

    let instrumentId = dto.instrumentId;
    if (!instrumentId) {
      if (dto.bankDetails) {
        const instrument = await this.payments.addBankInstrument(
          tenantId,
          dto.payerId,
          recipientId,
          dto.bankDetails,
        );
        instrumentId = instrument.id;
      } else if (dto.upiDetails) {
        const instrument = await this.payments.addUpiInstrument(
          tenantId,
          dto.payerId,
          recipientId,
          dto.upiDetails,
        );
        instrumentId = instrument.id;
      }
    }

    if (!instrumentId) {
      throw new Error('Instrument details are required');
    }

    const payout = await this.payments.createSinglePayout(tenantId, dto.payerId, {
      recipientId,
      instrumentId,
      amountPaise: dto.amountPaise,
      mode: dto.mode,
      purpose: dto.purpose,
      correlationId: dto.correlationId,
      idempotencyKey,
    });

    return { payoutId: payout.id, status: payout.status };
  }

  @Post('payouts')
  async createWorkflowBulkPayout(@Body() dto: WorkflowBulkPayoutRequestDto, @Req() req: Request) {
    const tenantId = (req as any).user?.id;
    const items = await Promise.all(
      (dto.payouts || []).map(async (item, index) => {
        const correlationId = item.correlationId || `row-${index + 1}`;
        const idempotencyKey = this.buildIdempotencyKey(
          tenantId,
          dto.payerId,
          dto.workflowRunId,
          dto.stepId,
          correlationId,
        );

        const recipient = await this.resolveRecipient(tenantId, dto.payerId, item.recipient);

        let instrumentId = item.instrumentId;
        if (!instrumentId && item.instrument) {
          if ((item.instrument as any).accountNumber) {
            const created = await this.payments.addBankInstrument(
              tenantId,
              dto.payerId,
              recipient.id,
              item.instrument as any,
            );
            instrumentId = created.id;
          } else if ((item.instrument as any).vpa) {
            const created = await this.payments.addUpiInstrument(
              tenantId,
              dto.payerId,
              recipient.id,
              item.instrument as any,
            );
            instrumentId = created.id;
          }
        }

        if (!instrumentId) {
          throw new Error('Instrument id or details are required');
        }

        return {
          recipientId: recipient.id,
          instrumentId,
          amountPaise: item.amountPaise,
          mode: item.mode || dto.defaultMode || PayoutMode.IMPS,
          purpose: item.purpose || dto.defaultPurpose,
          correlationId,
          idempotencyKey,
        };
      }),
    );

    const batch = await this.payments.createBulkPayoutBatch(tenantId, dto.payerId, items);
    return { batchId: batch.id, submittedCount: batch.submittedCount, status: batch.status };
  }

  private buildIdempotencyKey(
    tenantId: string,
    payerId: string,
    workflowRunId?: string,
    stepId?: string,
    correlationId?: string,
  ) {
    if (!workflowRunId || !stepId || !correlationId) return undefined;
    return computeIdempotencyKey(`${tenantId}|${payerId}|${workflowRunId}|${stepId}|${correlationId}`);
  }

  private async resolveRecipient(
    tenantId: string,
    payerId: string,
    recipient: { name: string; email?: string; phone?: string },
  ) {
    const existing = await this.payments.listRecipients(tenantId, payerId);
    const match = existing.find(
      (r) => r.name === recipient.name && r.email === recipient.email && r.phone === recipient.phone,
    );
    if (match) return match;
    return this.payments.createRecipient(tenantId, payerId, recipient);
  }
}
