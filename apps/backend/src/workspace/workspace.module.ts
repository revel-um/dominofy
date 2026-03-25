import {
  forwardRef,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from 'src/email/email.module';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { Workspace } from './workspace.entity';
import { WorkspaceMembership } from './workspace-membership.entity';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceBootstrapService } from './workspace-bootstrap.service';
import { Project } from 'src/projects/projects.entity';
import { User } from 'src/user/user.entity';
import { WorkspaceInvitation } from './workspace-invitation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, WorkspaceMembership, WorkspaceInvitation, Project, User]),
    forwardRef(() => EmailModule),
  ],
  providers: [WorkspaceService, WorkspaceBootstrapService],
  controllers: [WorkspaceController],
  exports: [WorkspaceService],
})
export class WorkspaceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VerifyTokenMiddleware)
      .exclude(
        { path: 'workspace/invitations/:token', method: RequestMethod.GET, version: '1' },
        { path: 'workspace/invitations/:token/accept', method: RequestMethod.POST, version: '1' },
      )
      .forRoutes(WorkspaceController);
  }
}
