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
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Request } from 'express';
import { BaseController } from 'src/common/base.controller';
import { Vault, VaultType } from './vault.entity';
import { VaultService } from './vault.service';
import { CreateVaultDto } from './vault.dto';
import { EmailService } from 'src/email/email.service';

@Controller('vault')
export class VaultController extends BaseController<
  Vault,
  Partial<CreateVaultDto>,
  Partial<CreateVaultDto>,
  string,
  VaultService
> {
  constructor(
    protected readonly service: VaultService,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
  ) {
    super(service, CreateVaultDto);
  }

  @Get('types')
  async listTypes() {
    const oauthInstallPaths: Partial<Record<VaultType, string>> = {
      [VaultType.EMAIL]: '/email/google/install-url',
      [VaultType.GOOGLE_DRIVE]: '/drive/google/install-url',
      [VaultType.GOOGLE_CALENDAR]: '/calendar/google/install-url',
      [VaultType.SLACK]: '/slack/install-url',
    };

    const formatLabel = (value: string) =>
      value
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    return Object.values(VaultType).map(type => ({
      type,
      label: formatLabel(type),
      installUrlPath: oauthInstallPaths[type],
    }));
  }

  /**
   * Create a new vault and automatically share it with the caller.
   */
  @Post()
  async createVault(
    @Req() req: Request,
    @Query('workspaceId') workspaceId: string | undefined,
    @Body() dto: CreateVaultDto,
  ): Promise<Vault> {
    const userId = (req as any).user.id;
    return this.service.create(dto, [userId], workspaceId, userId);
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
    return this.service.getVaultsByUser(userId, p, l);
  }

  /**
   * Get one vault (with its users)
   */
  @Get(':id')
  async findOneWithUsers(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user.id as string;
    return this.service.findOneForUser(id, userId);
  }

  @Post(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateVaultDto>,
    @Req() req?: Request,
  ): Promise<Vault> {
    if (!req) {
      throw new Error('Request is required');
    }
    const userId = (req as any).user.id as string;
    return this.service.updateForUser(id, dto, userId);
  }

  /**
   * Share a vault with additional users
   */
  @Post(':id/users')
  async addUsers(
    @Param('id') id: string,
    @Body('userIds') userIds: string[],
    @Req() req: Request,
  ): Promise<void> {
    const userId = (req as any).user.id as string;
    await this.service.addUsers(id, userIds, userId);
  }

  /**
   * Revoke user access from a vault
   */
  @Delete(':id/users')
  async removeUsers(
    @Param('id') id: string,
    @Body('userIds') userIds: string[],
    @Req() req: Request,
  ): Promise<void> {
    const userId = (req as any).user.id as string;
    await this.service.removeUsers(id, userIds, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req?: Request): Promise<void> {
    if (!req) {
      throw new Error('Request is required');
    }
    const userId = (req as any).user.id as string;
    const vault = await this.service.findOneForUser(id, userId);

    if (vault.type === VaultType.EMAIL) {
      const provider = (vault.connection as any)?.provider;
      if (provider === 'gmail') {
        await this.emailService.stopGmailWatch(
          vault.id.toString(),
          vault.connection as any,
        );
      }
    }

    await this.service.removeForUser(id, userId);
  }
}
