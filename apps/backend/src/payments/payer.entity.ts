import { Column, Entity, OneToMany, Index } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import {
  PaymentProviderName,
  PayerKycStatus,
  PayerOnboardingStatus,
} from './payments.enums';
import { Recipient } from './recipient.entity';
import { Payout } from './payout.entity';
import { PayoutBatch } from './payout-batch.entity';

@Entity('payment_payers')
@Index('idx_payment_payer_tenant', ['tenantId'])
export class Payer extends BaseEntity {
  @Column()
  tenantId: string;

  @Column({ type: 'enum', enum: PaymentProviderName })
  providerName: PaymentProviderName;

  @Column({ nullable: true })
  providerPayerAccountId?: string;

  @Column({ type: 'enum', enum: PayerKycStatus, default: PayerKycStatus.NOT_STARTED })
  kycStatus: PayerKycStatus;

  @Column({ type: 'enum', enum: PayerOnboardingStatus, default: PayerOnboardingStatus.NOT_STARTED })
  onboardingStatus: PayerOnboardingStatus;

  @Column({ nullable: true })
  companyName?: string;

  @Column({ nullable: true, type: 'jsonb' })
  providerMetadata?: Record<string, any>;

  @OneToMany(() => Recipient, (recipient) => recipient.payer)
  recipients: Recipient[];

  @OneToMany(() => Payout, (payout) => payout.payer)
  payouts: Payout[];

  @OneToMany(() => PayoutBatch, (batch) => batch.payer)
  batches: PayoutBatch[];
}
