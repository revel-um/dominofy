import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { Workspace } from './workspace.entity';
import { WorkspaceMembership } from './workspace-membership.entity';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceBootstrapService } from './workspace-bootstrap.service';

@Module({
  imports: [TypeOrmModule.forFeature([Workspace, WorkspaceMembership])],
  providers: [WorkspaceService, WorkspaceBootstrapService],
  controllers: [WorkspaceController],
  exports: [WorkspaceService],
})
export class WorkspaceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VerifyTokenMiddleware).forRoutes(WorkspaceController);
  }
}
