// src/vault/entities/vault.entity.ts
import {
  Entity,
  Column,
  ManyToMany,
  JoinTable,
  BeforeInsert,
  BeforeUpdate,
  AfterLoad,
} from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { User } from 'src/user/user.entity';
import { encrypt, decrypt } from 'src/helper/encryption';


/* ───────────────────────────────
 * Provider kinds
 * ─────────────────────────────── */
export enum VaultType {
  POSTGRES = 'postgres',
  MONGODB = 'mongodb',
  AWS = 'aws',
  CUSTOM = 'custom',
  SLACK = 'slack',
  EMAIL = 'email'
}

/* ───────────────────────────────
 * Entity
 * ─────────────────────────────── */
@Entity('vaults')
export class Vault extends BaseEntity {
  /* ---------- core ---------- */
  @Column() name: string;

  @Column({ type: 'enum', enum: VaultType })
  type: VaultType;

  /* ---------- encrypted payload ---------- */
  /** Base-64 ciphertext persisted in DB */
  @Column({ name: 'connection', type: 'text' })
  private connectionEnc!: string;

  /** Decrypted JSON kept only in memory */
  connection!: Record<string, any>;

  @Column({ nullable: true, type: 'jsonb' })
  lookupIds?: any;

  /* ---------- access control (users) ---------- */
  @ManyToMany(() => User, (u) => u.vaults, { cascade: false, eager: true })
  @JoinTable({
    name: 'vault_users',
    joinColumn: { name: 'vault_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  users: User[];

  /* ───── hooks ───── */

  /** Encrypt just before insert or update */
  @BeforeInsert()
  @BeforeUpdate()
  private async encryptConnection() {
    if (this.connection) {
      this.connectionEnc = await encrypt(JSON.stringify(this.connection));
    }
  }

  /** Decrypt right after entity is loaded from DB */
  @AfterLoad()
  private async decryptConnection() {
    if (this.connectionEnc) {
      this.connection = JSON.parse(await decrypt(this.connectionEnc));
    }
  }
}
