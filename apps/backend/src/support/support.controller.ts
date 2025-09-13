import { Body, Controller, Delete, Get, Param, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { CreateSupportDto } from './dto/create-support.dto';
import { SupportService } from './support.service';

@Controller({ path: 'support/tickets', version: '1' })
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  private getUserId(req: Request): string {
    const h = (req.headers['x-user-id'] || req.headers['x-userid'] || req.headers['x_user_id']) as string | undefined;
    return h && String(h) !== '' ? String(h) : 'anon';
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Req() req: Request, @Body() dto: CreateSupportDto) {
    const userId = this.getUserId(req);
    const ticket = this.supportService.create(userId, dto);
    return { id: ticket.id, status: ticket.status, createdAt: ticket.createdAt };
  }

  @Get('my')
  my(@Req() req: Request) {
    const userId = this.getUserId(req);
    return this.supportService.findMine(userId);
  }

  @Get(':id')
  getOne(@Req() req: Request, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.supportService.findOne(id, userId);
  }

  @Delete(':id')
  async delete(@Req() req: Request, @Param('id') id: string) {
    const userId = this.getUserId(req);
    await this.supportService.delete(id, userId);
    return { success: true };
  }
}
