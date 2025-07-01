// src/vault/dto/create-vault.dto.ts
import { IsEnum, IsNotEmpty, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { VaultType } from './vault.entity';

/**
 * Payload for creating / saving a new vault-connection record.
 * The `connection` object can contain ANY provider-specific keys
 * (host, port, database, username, password, ssl, certificates, …).
 *
 * Encryption is handled transparently by lifecycle hooks in
 * `Vault` — you don’t need to mutate this DTO before `save()`.
 */
export class CreateVaultDto {
  @IsNotEmpty()
  name: string;

  @IsEnum(VaultType)
  type: VaultType;

  /** Arbitrary provider-specific details (will be encrypted at rest). */
  @IsObject()
  @Type(() => Object)
  connection: Record<string, any>;
}
