import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowRevision } from './workflow-revision.entity';
import { WorkflowRevisionService } from './workflow-revision.service';
import { WorkflowRevisionController } from './workflow-revision.controller';
import { WorkflowModule } from '../workflow/workflow.module';
import { Workflow } from '../workflow/workflow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowRevision, Workflow]),
    WorkflowModule,
  ],
  providers: [WorkflowRevisionService],
  controllers: [WorkflowRevisionController],
  exports: [WorkflowRevisionService],
})
export class WorkflowRevisionModule {} 
