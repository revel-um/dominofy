import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { ProjectsModule } from 'src/projects/projects.module';
import { WorkspaceModule } from 'src/workspace/workspace.module';
import { RefreshToken } from 'src/auth/refresh-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken]),
    ProjectsModule,
    WorkspaceModule,
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VerifyTokenMiddleware)
      .exclude(
        { path: 'user/login', method: RequestMethod.POST, version: '1' },
        { path: 'user', method: RequestMethod.POST, version: '1' },
      )
      .forRoutes(UserController);
  }
}
