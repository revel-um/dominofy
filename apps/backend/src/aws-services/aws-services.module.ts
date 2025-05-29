import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { S3Service } from './s3.service';
import { S3Controller } from './s3.controller';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';

@Module({
  providers: [S3Service],
  controllers: [S3Controller],
})
export class AwsServicesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VerifyTokenMiddleware).forRoutes(S3Controller);
  }
}
