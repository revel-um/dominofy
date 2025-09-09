import { MiddlewareConsumer, Module, NestModule, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GcsService } from './gcs.service';
import { GcsController } from './gcs.controller';
import { Asset } from './gcs.entity';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { GcsServiceFactory } from './gcs-factory';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Asset])],
  providers: [GcsService],
  controllers: [GcsController],
  exports: [GcsService],
})
export class GcsModule implements NestModule, OnModuleInit {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VerifyTokenMiddleware).forRoutes(GcsController);
  }

  onModuleInit() {
    // Initialize the GCS service factory when the module loads
    GcsServiceFactory.initialize(this.assetRepository);
  }
}


