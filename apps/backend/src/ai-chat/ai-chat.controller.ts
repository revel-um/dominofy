import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { AiChatService } from './ai-chat.service';
import { CreateAiChatMessageDto } from './ai-chat.dto';

@Controller('ai-chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Get('workflow/:workflowId/messages')
  async listMessages(
    @Req() req: Request,
    @Param('workflowId') workflowId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const userId = (req as any).user.id;
    const parsedLimit = Math.min(Math.max(parseInt(limit ?? '20', 10), 1), 100);

    let beforeDate: Date | undefined;
    if (before) {
      const parsed = new Date(before);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid cursor provided');
      }
      beforeDate = parsed;
    }

    return await this.aiChatService.getMessages(
      userId,
      workflowId,
      parsedLimit,
      beforeDate,
    );
  }

  @Post('workflow/:workflowId/messages')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createMessage(
    @Req() req: Request,
    @Param('workflowId') workflowId: string,
    @Body() dto: CreateAiChatMessageDto,
  ) {
    const userId = (req as any).user.id;
    const message = await this.aiChatService.saveMessage(
      userId,
      workflowId,
      dto,
    );

    return {
      id: message.id,
      sender: message.sender,
      content: message.content,
      createdAt: message.createdAt,
    };
  }
}
