// src/vault/vault.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { BaseController } from 'src/common/base.controller';
import { Vault } from './vault.entity';
import { VaultService } from './vault.service';
import { CreateVaultDto } from './vault.dto';

@Controller('vault')
export class VaultController extends BaseController<
  Vault,
  Partial<CreateVaultDto>,
  Partial<CreateVaultDto>,
  string,
  VaultService
> {
  constructor(protected readonly vaultService: VaultService) {
    super(vaultService, CreateVaultDto);
  }

  /**
   * Create a new vault and automatically share it with the caller.
   */
  @Post()
  async createVault(
    @Req() req: Request,
    @Body() dto: CreateVaultDto,
  ): Promise<Vault> {
    const userId = (req as any).user.id;
    return this.vaultService.create(dto, [userId]);
  }

  /**
   * List all vaults shared with the caller, paginated.
   * GET /vault?page=1&limit=10
   */
  @Get()
  async findAllVaults(
    @Req() req: Request,
    @Query('page')  page: string = '1',
    @Query('limit') limit: string = '10',
  ): Promise<{
    items: Vault[];
    total: number;
    page: number;
    lastPage: number;
  }> {
    const userId = (req as any).user.id;
    const p = parseInt(page, 10)  || 1;
    const l = parseInt(limit, 10) || 10;
    return this.vaultService.getVaultsByUser(userId, p, l);
  }

  /**
   * Get one vault (with its users)
   */
  @Get(':id')
  async findOneWithUsers(@Param('id') id: string) {
    return this.vaultService.findOneWithUsers(id);
  }

  /**
   * Share a vault with additional users
   */
  @Post(':id/users')
  async addUsers(
    @Param('id') id: string,
    @Body('userIds') userIds: string[],
  ): Promise<void> {
    await this.vaultService.addUsers(id, userIds);
  }

  /**
   * Revoke user access from a vault
   */
  @Delete(':id/users')
  async removeUsers(
    @Param('id') id: string,
    @Body('userIds') userIds: string[],
  ): Promise<void> {
    await this.vaultService.removeUsers(id, userIds);
  }
}
