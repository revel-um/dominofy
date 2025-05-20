import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from './workflow.entity';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Workflow]), UserModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VerifyTokenMiddleware).forRoutes(WorkflowController);
  }
}
