import { Column, Entity, ManyToOne, OneToMany, Index } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { PayoutBatchStatus } from './payments.enums';
import { Payer } from './payer.entity';
import { Payout } from './payout.entity';

@Entity('payment_payout_batches')
@Index('idx_payment_batch_tenant', ['tenantId'])
export class PayoutBatch extends BaseEntity {
  @Column()
  tenantId: string;

  @ManyToOne(() => Payer, (payer) => payer.batches, { onDelete: 'CASCADE' })
  payer: Payer;

  @Column({ type: 'enum', enum: PayoutBatchStatus, default: PayoutBatchStatus.QUEUED })
  status: PayoutBatchStatus;

  @Column({ type: 'int', default: 0 })
  totalCount: number;

  @Column({ type: 'int', default: 0 })
  processedCount: number;

  @Column({ type: 'int', default: 0 })
  failedCount: number;

  @Column({ type: 'int', default: 0 })
  submittedCount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => Payout, (payout) => payout.batch)
  payouts: Payout[];
}
