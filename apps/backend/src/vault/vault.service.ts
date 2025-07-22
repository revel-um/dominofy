import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { BaseService } from 'src/common/base.service';
import { User } from 'src/user/user.entity';
import { CreateVaultDto } from './vault.dto';
import { Vault, VaultType } from './vault.entity';

@Injectable()
export class VaultService extends BaseService<Vault> {
    constructor(
        @InjectRepository(Vault)
        private readonly vaultRepository: Repository<Vault>,
        private readonly dataSource: DataSource,
    ) {
        super(vaultRepository);
    }

    /* ─────────────────────────────
     * Create a new vault record
     * ────────────────────────────*/
    async create(dto: CreateVaultDto, userIds: string[] = []) {
        return this.dataSource.transaction(async (manager) => {
            console.log(dto.lookupIds);
            /* ---------- build entity ---------- */
            const vault = manager.create(Vault, {
                name: dto.name,
                type: dto.type,
                lookupIds: dto.lookupIds,
                connection: dto.connection, // hooks encrypt on save
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
        return this.vaultRepository.find({
            where: { type, users: { id: userId } as any } as any,
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

    /* ─────────────────────────────
     * Pagination
     * ────────────────────────────*/
    async getVaultsByUser(userId: string, page = 1, limit = 10) {
        const [items, total] = await this.vaultRepository
            .createQueryBuilder('vault')
            .innerJoin('vault.users', 'user', 'user.id = :userId', { userId })
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
