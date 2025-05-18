import { Module, NestModule } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './projects.entity';
import { User } from 'src/user/user.entity';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, User])
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule implements NestModule {
  configure(consumer: any) {
    consumer.apply(VerifyTokenMiddleware).forRoutes(ProjectsController);
  }
}
