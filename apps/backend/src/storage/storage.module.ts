import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceModule } from 'src/workspace/workspace.module';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { Collection } from './collection.entity';
import { Document } from './document.entity';
import { CollectionsService } from './collections.service';
import { DocumentsService } from './documents.service';
import { CollectionsController } from './collections.controller';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Collection, Document]), WorkspaceModule],
  providers: [CollectionsService, DocumentsService],
  controllers: [CollectionsController, DocumentsController],
  exports: [CollectionsService, DocumentsService],
})
export class StorageModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VerifyTokenMiddleware)
      .forRoutes(CollectionsController, DocumentsController);
  }
}
