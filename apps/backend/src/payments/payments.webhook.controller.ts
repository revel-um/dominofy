import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PaymentProviderName } from './payments.enums';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { WebhookEvent } from './webhook-event.entity';

@Controller({ path: 'payments/webhooks', version: '1' })
export class PaymentsWebhookController {
  constructor(
    private readonly providerFactory: PaymentProviderFactory,
    private readonly orchestrator: PaymentOrchestratorService,
  ) {}

  @Post('razorpay')
  async handleRazorpayWebhook(@Req() req: Request, @Headers() headers: Record<string, any>, @Body() body: any) {
    const rawBody = (req as any).rawBody || JSON.stringify(body || {});
    const provider = this.providerFactory.getProvider(PaymentProviderName.RAZORPAY);
    const signatureValid = provider.verifyWebhookSignature(rawBody, headers);

    const normalized = provider.normalizeWebhook(rawBody);
    const event = new WebhookEvent();
    event.providerName = PaymentProviderName.RAZORPAY;
    event.signatureValid = signatureValid;
    event.rawBody = rawBody;
    event.headers = headers;
    event.normalized = normalized ? {
      providerPayoutId: normalized.providerPayoutId,
      status: normalized.status,
      failureCode: normalized.failureCode,
      failureMessage: normalized.failureMessage,
    } : undefined;
    await this.orchestrator.storeWebhookEvent(event);

    if (signatureValid && normalized) {
      await this.orchestrator.updatePayoutFromWebhook(normalized);
    }

    return { ok: true };
  }
}
