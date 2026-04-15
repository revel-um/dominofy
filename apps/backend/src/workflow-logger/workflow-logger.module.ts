import { forwardRef, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { WorkflowLoggerService } from './workflow-logger.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowLog } from './workflow-logger.entity';
import { DeployedWorkflowLog } from './deployed-workflow-log.entity';
import { WorkflowLoggerController } from './workflow-logger.controller';
import { WorkflowModule } from 'src/workflow/workflow.module';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { Execution } from 'src/workflow/execution.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowLog, DeployedWorkflowLog, Execution]), forwardRef(() => WorkflowModule)],
  providers: [WorkflowLoggerService],
  exports: [WorkflowLoggerService],
  controllers: [WorkflowLoggerController],
})
export class WorkflowLoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VerifyTokenMiddleware)
      .forRoutes(WorkflowLoggerController);
  }
}
