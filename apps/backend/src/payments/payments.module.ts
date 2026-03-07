import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments.webhook.controller';
import { PaymentsWorkflowController } from './payments.workflow.controller';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { RazorpayProviderStrategy } from './providers/razorpay.strategy';
import { PayoutQueueService } from './worker/payout-queue.service';
import { Payer } from './payer.entity';
import { Recipient } from './recipient.entity';
import { PaymentInstrument } from './payment-instrument.entity';
import { Payout } from './payout.entity';
import { PayoutBatch } from './payout-batch.entity';
import { WebhookEvent } from './webhook-event.entity';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payer,
      Recipient,
      PaymentInstrument,
      Payout,
      PayoutBatch,
      WebhookEvent,
    ]),
  ],
  controllers: [PaymentsController, PaymentsWebhookController, PaymentsWorkflowController],
  providers: [
    RazorpayProviderStrategy,
    {
      provide: 'PAYMENT_PROVIDER_STRATEGIES',
      useFactory: (razorpay: RazorpayProviderStrategy) => [razorpay],
      inject: [RazorpayProviderStrategy],
    },
    PaymentProviderFactory,
    PaymentOrchestratorService,
    PayoutQueueService,
  ],
  exports: [PaymentOrchestratorService],
})
export class PaymentsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VerifyTokenMiddleware)
      .exclude({ path: 'payments/webhooks/razorpay', method: RequestMethod.POST, version: '1' })
      .forRoutes(PaymentsController, PaymentsWorkflowController);
  }
}
