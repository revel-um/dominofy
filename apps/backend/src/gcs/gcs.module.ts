import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { GcsService } from './gcs.service';
import { GcsController } from './gcs.controller';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';

@Module({
  providers: [GcsService],
  controllers: [GcsController],
})
export class GcpServicesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VerifyTokenMiddleware).forRoutes(GcsController);
  }
}


