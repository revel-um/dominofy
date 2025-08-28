import { Module, forwardRef } from '@nestjs/common';
import { RunnerLauncherService } from './runner-launcher.service';
import { WorkflowLoggerModule } from 'src/workflow-logger/workflow-logger.module';
import { SlackModule } from 'src/slack/slack.module';

@Module({
    imports: [WorkflowLoggerModule, forwardRef(() => SlackModule)],
    exports: [RunnerLauncherService],
    providers: [RunnerLauncherService]
})
export class RunnerLauncherModule { }
