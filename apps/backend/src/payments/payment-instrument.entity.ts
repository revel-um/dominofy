import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { PaymentInstrumentType } from './payments.enums';
import { Payer } from './payer.entity';
import { Recipient } from './recipient.entity';

@Entity('payment_instruments')
@Index('idx_payment_instrument_tenant', ['tenantId'])
@Index('idx_payment_instrument_payer', ['payer'])
@Index('idx_payment_instrument_recipient', ['recipient'])
@Index('uq_payment_instrument_fingerprint', ['payer', 'recipient', 'type', 'fingerprint'], { unique: true })
export class PaymentInstrument extends BaseEntity {
  @Column()
  tenantId: string;

  @ManyToOne(() => Payer, { onDelete: 'CASCADE' })
  payer: Payer;

  @ManyToOne(() => Recipient, (recipient) => recipient.instruments, { onDelete: 'CASCADE' })
  recipient: Recipient;

  @Column({ type: 'enum', enum: PaymentInstrumentType })
  type: PaymentInstrumentType;

  @Column({ name: 'payload_enc', type: 'text' })
  payloadEnc: string;

  @Column({ nullable: true })
  bankLast4?: string;

  @Column({ nullable: true })
  bankIfsc?: string;

  @Column({ nullable: true })
  upiVpaHash?: string;

  @Column({ nullable: true })
  holderName?: string;

  @Column({ nullable: true })
  providerInstrumentId?: string;

  @Column()
  fingerprint: string;
}
