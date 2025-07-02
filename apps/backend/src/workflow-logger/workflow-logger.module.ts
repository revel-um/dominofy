import { Module } from '@nestjs/common';
import { WorkflowLoggerService } from './workflow-logger.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowLog } from './workflow-logger.entity';
import { RunnerLauncherService } from './runner-launcher';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowLog])],
  providers: [WorkflowLoggerService, RunnerLauncherService],
  exports: [RunnerLauncherService]
})
export class WorkflowLoggerModule {}
