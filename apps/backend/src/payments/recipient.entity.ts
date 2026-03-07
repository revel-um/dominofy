import { Column, Entity, ManyToOne, OneToMany, Index } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Payer } from './payer.entity';
import { PaymentInstrument } from './payment-instrument.entity';

@Entity('payment_recipients')
@Index('idx_payment_recipient_tenant', ['tenantId'])
@Index('idx_payment_recipient_payer', ['payer'])
export class Recipient extends BaseEntity {
  @Column()
  tenantId: string;

  @ManyToOne(() => Payer, (payer) => payer.recipients, { onDelete: 'CASCADE' })
  payer: Payer;

  @Column()
  name: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  providerContactId?: string;

  @OneToMany(() => PaymentInstrument, (instrument) => instrument.recipient)
  instruments: PaymentInstrument[];
}
