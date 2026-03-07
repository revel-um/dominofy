import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import {
  AddBankInstrumentDto,
  AddUpiInstrumentDto,
  BulkPayoutRequestDto,
  ConnectPayerProviderDto,
  CreateRecipientDto,
  PayoutRequestDto,
} from './payments.dto';

@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private readonly payments: PaymentOrchestratorService) {}

  @Post('payers/connect')
  async connectProvider(@Body() dto: ConnectPayerProviderDto, @Req() req: Request) {
    const tenantId = (req as any).user?.id;
    return this.payments.connectPayerProvider(tenantId, dto.providerName, dto.companyName);
  }

  @Get('payers')
  async listPayers(@Req() req: Request) {
    const tenantId = (req as any).user?.id;
    return this.payments.listPayers(tenantId);
  }

  @Get('payers/:payerId/status')
  async getPayerStatus(@Param('payerId') payerId: string, @Query('refresh') refresh: string, @Req() req: Request) {
    const tenantId = (req as any).user?.id;
    return this.payments.getPayerProviderStatus(tenantId, payerId, refresh === 'true');
  }

  @Post('payers/:payerId/recipients')
  async createRecipient(
    @Param('payerId') payerId: string,
    @Body() dto: CreateRecipientDto,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.id;
    return this.payments.createRecipient(tenantId, payerId, dto);
  }

  @Get('payers/:payerId/recipients')
  async listRecipients(@Param('payerId') payerId: string, @Req() req: Request) {
    const tenantId = (req as any).user?.id;
    return this.payments.listRecipients(tenantId, payerId);
  }

  @Get('payers/:payerId/recipients/:recipientId/instruments')
  async listInstruments(
    @Param('payerId') payerId: string,
    @Param('recipientId') recipientId: string,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.id;
    return this.payments.listInstruments(tenantId, payerId, recipientId);
  }

  @Post('payers/:payerId/recipients/:recipientId/instruments/bank')
  async addBankInstrument(
    @Param('payerId') payerId: string,
    @Param('recipientId') recipientId: string,
    @Body() dto: AddBankInstrumentDto,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.id;
    return this.payments.addBankInstrument(tenantId, payerId, recipientId, dto);
  }

  @Post('payers/:payerId/recipients/:recipientId/instruments/upi')
  async addUpiInstrument(
    @Param('payerId') payerId: string,
    @Param('recipientId') recipientId: string,
    @Body() dto: AddUpiInstrumentDto,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.id;
    return this.payments.addUpiInstrument(tenantId, payerId, recipientId, dto);
  }

  @Post('payers/:payerId/payouts')
  async createPayout(
    @Param('payerId') payerId: string,
    @Body() dto: PayoutRequestDto,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.id;
    return this.payments.createSinglePayout(tenantId, payerId, {
      recipientId: dto.recipientId,
      instrumentId: dto.instrumentId,
      amountPaise: dto.amountPaise,
      mode: dto.mode,
      purpose: dto.purpose,
      correlationId: dto.correlationId,
    });
  }

  @Post('payers/:payerId/payout-batches')
  async createBatch(
    @Param('payerId') payerId: string,
    @Body() dto: BulkPayoutRequestDto,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.id;
    const batch = await this.payments.createBulkPayoutBatch(
      tenantId,
      payerId,
      dto.payouts.map((p) => ({
        recipientId: p.recipientId,
        instrumentId: p.instrumentId,
        amountPaise: p.amountPaise,
        mode: p.mode,
        purpose: p.purpose,
        correlationId: p.correlationId,
      })),
    );
    return { batchId: batch.id, totalCount: batch.totalCount, status: batch.status };
  }

  @Get('payouts')
  async listPayouts(@Req() req: Request, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    const tenantId = (req as any).user?.id;
    const [items, count] = await this.payments.listPayouts(tenantId, Number(limit) || 50, Number(offset) || 0);
    return { items, count };
  }

  @Get('payout-batches')
  async listBatches(@Req() req: Request, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    const tenantId = (req as any).user?.id;
    const [items, count] = await this.payments.listBatches(tenantId, Number(limit) || 50, Number(offset) || 0);
    return { items, count };
  }

  @Get('payouts/:payoutId')
  async getPayout(@Param('payoutId') payoutId: string, @Req() req: Request) {
    const tenantId = (req as any).user?.id;
    return this.payments.getPayout(tenantId, payoutId);
  }

  @Get('payout-batches/:batchId')
  async getBatch(@Param('batchId') batchId: string, @Req() req: Request) {
    const tenantId = (req as any).user?.id;
    return this.payments.getBatch(tenantId, batchId);
  }

  @Post('payout-batches/:batchId/retry-failed')
  async retryFailed(@Param('batchId') batchId: string, @Req() req: Request) {
    const tenantId = (req as any).user?.id;
    return this.payments.retryFailedPayouts(tenantId, batchId);
  }
}
