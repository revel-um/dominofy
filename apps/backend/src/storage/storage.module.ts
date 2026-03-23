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
import { StorageRuntimeService } from './storage-runtime.service';
import { Workflow } from 'src/workflow/workflow.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Collection, Document, Workflow]), WorkspaceModule],
  providers: [CollectionsService, DocumentsService, StorageRuntimeService],
  controllers: [CollectionsController, DocumentsController],
  exports: [CollectionsService, DocumentsService, StorageRuntimeService],
})
export class StorageModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VerifyTokenMiddleware)
      .forRoutes(CollectionsController, DocumentsController);
  }
}
