import { Body, Controller, Delete, Get, Param, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { CreateSupportDto } from './dto/create-support.dto';
import { SupportService } from './support.service';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller({ path: 'support/tickets', version: '1' })
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSupportDto) {
    const userId = req.user.id;
    const ticket = await this.supportService.create(userId, dto);
    return { id: ticket.id, status: ticket.status, createdAt: ticket.createdAt };
  }

  @Get()
  async my(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return await this.supportService.findMine(userId);
  }

  @Get(':id')
  async getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.id;
    return await this.supportService.findOne(id, userId);
  }

  @Delete(':id')
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.id;
    await this.supportService.delete(id, userId);
    return { success: true };
  }
}
