import { Module } from '@nestjs/common';
import { RunnerLauncherService } from './runner-launcher.service';
import { WorkflowLoggerModule } from 'src/workflow-logger/workflow-logger.module';

@Module({
    imports: [WorkflowLoggerModule],
    exports: [RunnerLauncherService],
    providers: [RunnerLauncherService]
})
export class RunnerLauncherModule { }
