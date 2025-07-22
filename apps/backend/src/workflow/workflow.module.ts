import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from './workflow.entity';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { UserModule } from 'src/user/user.module';
import { WorkflowLoggerModule } from 'src/workflow-logger/workflow-logger.module';

@Module({
  imports: [TypeOrmModule.forFeature([Workflow]), UserModule, WorkflowLoggerModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VerifyTokenMiddleware).exclude(
      { path: 'workflow/:workflowId/trigger/:functionName', method: RequestMethod.POST, version: '1' },
      { path: 'workflow/:workflowId/trigger/:functionName', method: RequestMethod.GET, version: '1' }
    ).forRoutes(WorkflowController);
  }
}
