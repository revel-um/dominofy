import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Schedule } from './scheduler.entity';
import { SchedulerService } from './scheduler.service';
import { Workflow } from 'src/workflow/workflow.entity';
import { RunnerLauncherModule } from 'src/runner-launcher/runner-launcher.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Schedule, Workflow]),
    RunnerLauncherModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
