import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { BaseService } from 'src/common/base.service';
import { User } from 'src/user/user.entity';
import { CreateVaultDto } from './vault.dto';
import { Vault, VaultType } from './vault.entity';
import { encrypt } from 'src/helper/encryption';
import { WorkspaceService } from 'src/workspace/workspace.service';

@Injectable()
export class VaultService extends BaseService<Vault> {
    constructor(
        @InjectRepository(Vault)
        private readonly vaultRepository: Repository<Vault>,
        private readonly dataSource: DataSource,
        @Inject(forwardRef(() => WorkspaceService))
        private readonly workspaceService: WorkspaceService,
    ) {
        super(vaultRepository);
    }

    private sanitizeLookupIds(lookupIds?: Record<string, any>) {
        if (!lookupIds) return lookupIds;
        const {
            connectionStatus,
            connectionErrorAt,
            connectionErrorCode,
            connectionErrorMessage,
            ...rest
        } = lookupIds;
        return rest;
    }

    isVaultActive(vault: Pick<Vault, 'isActive'> | null | undefined): boolean {
        return vault?.isActive !== false;
    }

    /* ─────────────────────────────
     * Create a new vault record
     * ────────────────────────────*/
    async create(
        dto: CreateVaultDto,
        userIds: string[] = [],
        workspaceId?: string,
        ownerUserId?: string,
    ) {
        return this.dataSource.transaction(async (manager) => {
            const resolvedOwnerUserId = ownerUserId ?? userIds[0];
            if (!resolvedOwnerUserId) {
                throw new Error('Vault creation requires an owning user to resolve workspace');
            }

            const resolvedWorkspaceId = await this.workspaceService.resolveWorkspaceIdForUser(
                resolvedOwnerUserId,
                workspaceId,
                undefined,
                manager,
            );

            /* ---------- build entity ---------- */
            const vault = manager.create(Vault, {
                name: dto.name,
                type: dto.type,
                lookupIds: this.sanitizeLookupIds(dto.lookupIds),
                connection: dto.connection, // hooks encrypt on save
                workspace: { id: resolvedWorkspaceId } as any,
            });
            vault.connection = dto.connection; // set decrypted connection

            /* ---------- attach users (optional) ---------- */
            if (userIds.length) {
                vault.users = await manager
                    .getRepository(User)
                    .findByIds(userIds);
            }

            /* ---------- persist ---------- */
            return manager.save(vault);
        });
    }

    /* ─────────────────────────────
     * Generic fetch helpers
     * ────────────────────────────*/
    async findOne(id: string, relations: string[] = []): Promise<Vault | null> {
        return this.vaultRepository.findOne({ where: { id }, relations });
    }

    async findWhere(condition: any, relations: any) {
        return this.vaultRepository.findOne({
            where: condition,
            relations: relations
        });
    }

    async findOneByIdAndType(
        id: string,
        type: VaultType,
        relations: string[] = [],
    ): Promise<Vault | null> {
        return this.vaultRepository.findOne({
            where: { id, type } as any,
            relations,
        });
    }

    async findByTypeAndUser(
        type: VaultType,
        userId: string,
    ): Promise<Vault[]> {
        return this.vaultRepository
            .createQueryBuilder('vault')
            .innerJoin('vault.users', 'user', 'user.id = :userId', { userId })
            .where('vault.type = :type', { type })
            .andWhere('vault.isActive = true')
            .getMany();
    }

    async findByType(type: VaultType): Promise<Vault[]> {
        return this.vaultRepository.find({
            where: { type, isActive: true } as any,
        });
    }

    /* ─────────────────────────────
     * Attach / detach users
     * ────────────────────────────*/
    async addUsers(id: string, userIds: string[]) {
        await this.vaultRepository
            .createQueryBuilder()
            .relation(Vault, 'users')
            .of(id)
            .add(userIds);
    }

    async removeUsers(id: string, userIds: string[]) {
        await this.vaultRepository
            .createQueryBuilder()
            .relation(Vault, 'users')
            .of(id)
            .remove(userIds);
    }

    async findOneWithUsers(id: string) {
        return this.vaultRepository.findOne({
            where: { id },
            relations: ['users'],
        });
    }

    async updateConnection(
        id: string,
        connection: Record<string, any>,
    ): Promise<Vault> {
        const encrypted = await encrypt(JSON.stringify(connection));
        await this.vaultRepository.update(
            id,
            { connectionEnc: encrypted } as any,
        );
        const vault = await this.vaultRepository.findOne({ where: { id } });
        if (!vault) {
            throw new Error(`Vault ${id} not found`);
        }
        return vault;
    }

    async updateLookupIds(
        id: string,
        lookupIds: Record<string, any>,
    ): Promise<Vault> {
        await this.vaultRepository.update(
            id,
            { lookupIds: this.sanitizeLookupIds(lookupIds) } as any,
        );
        const vault = await this.vaultRepository.findOne({ where: { id } });
        if (!vault) {
            throw new Error(`Vault ${id} not found`);
        }
        return vault;
    }

    async markVaultConnectionInvalid(
        id: string,
        connection: Record<string, any>,
    ): Promise<Vault> {
        const encrypted = await encrypt(JSON.stringify(connection));
        await this.vaultRepository.update(
            id,
            { connectionEnc: encrypted, isActive: false } as any,
        );
        const vault = await this.vaultRepository.findOne({ where: { id } });
        if (!vault) {
            throw new Error(`Vault ${id} not found`);
        }
        return vault;
    }

    async reactivateVaultConnection(
        id: string,
        connection: Record<string, any>,
        lookupIds?: Record<string, any>,
    ): Promise<Vault> {
        const vault = await this.findOne(id);
        if (!vault) {
            throw new Error(`Vault ${id} not found`);
        }
        const encrypted = await encrypt(JSON.stringify(connection));
        await this.vaultRepository.update(
            id,
            {
                connectionEnc: encrypted,
                lookupIds: this.sanitizeLookupIds({
                    ...(vault.lookupIds ?? {}),
                    ...(lookupIds ?? {}),
                }),
                isActive: true,
            } as any,
        );
        const updated = await this.vaultRepository.findOne({ where: { id } });
        if (!updated) {
            throw new Error(`Vault ${id} not found`);
        }
        return updated;
    }

    async touchUpdatedAt(id: string, updatedAt: Date = new Date()): Promise<void> {
        await this.vaultRepository.update(id, { updatedAt } as any);
    }

    async findOldestGmailVaults(
        limit: number,
        olderThan: Date,
    ): Promise<Vault[]> {
        return this.vaultRepository
            .createQueryBuilder('vault')
            .where('vault.type = :type', { type: VaultType.EMAIL })
            .andWhere("vault.lookupIds ->> 'provider' = :provider", {
                provider: 'gmail',
            })
            .andWhere('vault.isActive = true')
            .andWhere('vault.updatedAt <= :olderThan', { olderThan })
            .orderBy('vault.updatedAt', 'ASC')
            .limit(limit)
            .getMany();
    }

    /* ─────────────────────────────
     * Pagination
     * ────────────────────────────*/
    async getVaultsByUser(userId: string, page = 1, limit = 10) {
        const [items, total] = await this.vaultRepository
            .createQueryBuilder('vault')
            .innerJoin('vault.users', 'user', 'user.id = :userId', { userId })
            .where('vault.isActive = true')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        return {
            items,
            total,
            page,
            lastPage: Math.ceil(total / limit) || 1,
        };
    }
}
