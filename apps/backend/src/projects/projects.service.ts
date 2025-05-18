import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Project } from './projects.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ProjectsService extends BaseService<Project>{
    constructor(
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
      ) {
        super(projectRepository);
      }

      async findAll(userId: string, limit = 10, offset = 0) {
        return this.projectRepository.find({
          where: { user: { id: userId } },
          skip: offset,
          take: limit,
          order: { updatedAt: 'DESC' },
        });
      }
}
