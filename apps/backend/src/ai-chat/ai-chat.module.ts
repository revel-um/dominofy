import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiChatMessage } from './ai-chat.entity';
import { WorkflowModule } from 'src/workflow/workflow.module';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';

@Module({
  imports: [TypeOrmModule.forFeature([AiChatMessage]), WorkflowModule],
  controllers: [AiChatController],
  providers: [AiChatService],
})
export class AiChatModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VerifyTokenMiddleware).forRoutes(AiChatController);
  }
}
