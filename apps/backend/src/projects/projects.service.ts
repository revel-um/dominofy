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
}
