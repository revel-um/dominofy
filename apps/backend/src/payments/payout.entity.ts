import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { PaymentInstrument } from './payment-instrument.entity';
import { Payer } from './payer.entity';
import { Recipient } from './recipient.entity';
import { PayoutBatch } from './payout-batch.entity';
import { PaymentProviderName, PayoutMode, PayoutStatus } from './payments.enums';

@Entity('payment_payouts')
@Index('idx_payment_payout_tenant', ['tenantId'])
@Index('idx_payment_payout_status', ['status'])
@Index('uq_payment_payout_idempotency', ['idempotencyKey'], { unique: true })
@Index('idx_payment_payout_provider', ['providerPayoutId'])
export class Payout extends BaseEntity {
  @Column()
  tenantId: string;

  @ManyToOne(() => Payer, (payer) => payer.payouts, { onDelete: 'CASCADE' })
  payer: Payer;

  @ManyToOne(() => Recipient, { onDelete: 'SET NULL' })
  recipient?: Recipient;

  @ManyToOne(() => PaymentInstrument, { onDelete: 'SET NULL' })
  instrument?: PaymentInstrument;

  @ManyToOne(() => PayoutBatch, (batch) => batch.payouts, { nullable: true, onDelete: 'SET NULL' })
  batch?: PayoutBatch;

  @Column({ type: 'enum', enum: PaymentProviderName })
  providerName: PaymentProviderName;

  @Column({ type: 'enum', enum: PayoutMode })
  mode: PayoutMode;

  @Column({ type: 'int' })
  amountPaise: number;

  @Column({ default: 'INR' })
  currency: string;

  @Column({ nullable: true })
  purpose?: string;

  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.QUEUED })
  status: PayoutStatus;

  @Column()
  idempotencyKey: string;

  @Column({ nullable: true })
  providerPayoutId?: string;

  @Column({ nullable: true })
  failureCode?: string;

  @Column({ nullable: true })
  failureMessage?: string;

  @Column({ nullable: true })
  correlationId?: string;

  @Column({ type: 'jsonb', nullable: true })
  rawProviderResponse?: Record<string, any>;
}
