import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
  forwardRef,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { VaultModule } from 'src/vault/vault.module';
import { UserModule } from 'src/user/user.module';
import { WorkflowModule } from 'src/workflow/workflow.module';
import { RunnerLauncherModule } from 'src/runner-launcher/runner-launcher.module';
import { WorkflowLoggerModule } from 'src/workflow-logger/workflow-logger.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => VaultModule),
    forwardRef(() => UserModule),
    forwardRef(() => WorkflowModule),
    forwardRef(() => RunnerLauncherModule),
    WorkflowLoggerModule,
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VerifyTokenMiddleware)
      .exclude(
        { path: 'calendar/google/callback', method: RequestMethod.GET, version: '1' },
      )
      .forRoutes(CalendarController);
  }
}
