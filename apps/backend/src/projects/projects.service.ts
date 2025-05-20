import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Project } from './projects.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

@Injectable()
export class ProjectsService extends BaseService<Project> {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {
    super(projectRepository);
  }

  async findAll(userId: string, limit = 10, offset = 0, query?: string) {
    const where: any = { user: { id: userId } };
    if (query) {
      where.name = ILike(`%${query}%`); // Use Like operator for partial match
    }

    return this.projectRepository.findAndCount({
      where,
      skip: offset,
      take: limit,
      order: { updatedAt: 'DESC' },
    });
  }
}
