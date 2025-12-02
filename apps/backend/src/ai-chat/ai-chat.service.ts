import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiChatMessage } from './ai-chat.entity';
import { WorkflowService } from 'src/workflow/workflow.service';
import { CreateAiChatMessageDto } from './ai-chat.dto';

@Injectable()
export class AiChatService {
  constructor(
    @InjectRepository(AiChatMessage)
    private readonly aiChatRepository: Repository<AiChatMessage>,
    private readonly workflowService: WorkflowService,
  ) {}

  async saveMessage(
    userId: string,
    workflowId: string,
    dto: CreateAiChatMessageDto,
  ): Promise<AiChatMessage> {
    await this.workflowService.findOneAndVerify(workflowId, userId);

    const entity = this.aiChatRepository.create({
      sender: dto.sender,
      content: dto.content,
      workflow: { id: workflowId } as any,
      workflowId,
      user: { id: userId } as any,
      userId,
    });

    return await this.aiChatRepository.save(entity);
  }

  async getMessages(
    userId: string,
    workflowId: string,
    limit: number,
    before?: Date,
  ) {
    await this.workflowService.findOneAndVerify(workflowId, userId);

    const qb = this.aiChatRepository
      .createQueryBuilder('m')
      .where('m.workflowId = :workflowId', { workflowId })
      .orderBy('m.createdAt', 'DESC')
      .take(limit + 1);

    if (before) {
      qb.andWhere('m.createdAt < :before', { before });
    }

    const rows = await qb.getMany();
    const items = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const nextCursor =
      hasMore && items.length
        ? items[items.length - 1].createdAt.toISOString()
        : null;

    return { items, hasMore, nextCursor };
  }
}
