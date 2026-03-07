import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { PaymentProviderName } from './payments.enums';

@Entity('payment_webhook_events')
@Index('idx_payment_webhook_provider', ['providerName'])
export class WebhookEvent extends BaseEntity {
  @Column({ type: 'enum', enum: PaymentProviderName })
  providerName: PaymentProviderName;

  @Column({ nullable: true })
  providerEventId?: string;

  @Column({ default: false })
  signatureValid: boolean;

  @Column({ type: 'text' })
  rawBody: string;

  @Column({ type: 'jsonb', nullable: true })
  headers?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  normalized?: Record<string, any>;
}
