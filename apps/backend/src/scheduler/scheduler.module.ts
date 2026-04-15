import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Schedule } from './scheduler.entity';
import { SchedulerService } from './scheduler.service';
import { DeployedWorkflow } from 'src/workflow/deployed-workflow.entity';
import { Workflow } from 'src/workflow/workflow.entity';
import { WorkflowModule } from 'src/workflow/workflow.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Schedule, Workflow, DeployedWorkflow]),
    forwardRef(() => WorkflowModule),
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
