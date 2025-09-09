import { Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProjectsModule } from './projects/projects.module';
import { UserModule } from './user/user.module';
import { WorkflowModule } from './workflow/workflow.module';
import { VerifyTokenMiddleware } from './middlewares/auth.middleware';
import { AwsServicesModule } from './aws-services/aws-services.module';
import { WorkflowLoggerModule } from './workflow-logger/workflow-logger.module';
import { VaultModule } from './vault/vault.module';
import { SlackModule } from './slack/slack.module';
import { RunnerLauncherModule } from './runner-launcher/runner-launcher.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT'),
        username: config.get('DATABASE_USER'),
        password: config.get('DATABASE_PASSWORD'),
        database: config.get('DATABASE_NAME'),
        schema: config.get('DATABASE_SCHEMA'),
        autoLoadEntities: true,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    ProjectsModule,
    UserModule,
    WorkflowModule,
    AwsServicesModule,
    WorkflowLoggerModule,
    VaultModule,
    SlackModule,
    RunnerLauncherModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, VerifyTokenMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: import('@nestjs/common').MiddlewareConsumer) {
    consumer.apply(VerifyTokenMiddleware).forRoutes(AppController);
  }
}
