import { MiddlewareConsumer, Module, NestModule, RequestMethod, forwardRef } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from './workflow.entity';
import { DeployedWorkflow } from './deployed-workflow.entity';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { UserModule } from 'src/user/user.module';
import { RunnerLauncherModule } from 'src/runner-launcher/runner-launcher.module';
import { SchedulerModule } from 'src/scheduler/scheduler.module';
import { Project } from 'src/projects/projects.entity';
import { WorkspaceModule } from 'src/workspace/workspace.module';
import { WorkflowLoggerModule } from 'src/workflow-logger/workflow-logger.module';
import { DeployedExecutionMetric } from './deployed-execution-metric.entity';
import { DeployedExecutionMetricsService } from './deployed-execution-metrics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow, DeployedWorkflow, Project]),
    TypeOrmModule.forFeature([DeployedExecutionMetric]),
    forwardRef(() => UserModule),
    forwardRef(() => RunnerLauncherModule),
    forwardRef(() => SchedulerModule),
    forwardRef(() => WorkspaceModule),
    forwardRef(() => WorkflowLoggerModule),
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService, DeployedExecutionMetricsService],
  exports: [WorkflowService, DeployedExecutionMetricsService],
})
export class WorkflowModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VerifyTokenMiddleware).exclude(
      { path: 'workflow/:workflowId/trigger/:functionName', method: RequestMethod.POST, version: '1' },
      { path: 'workflow/:workflowId/trigger/:functionName', method: RequestMethod.GET, version: '1' }
    ).forRoutes(WorkflowController);
  }
}
