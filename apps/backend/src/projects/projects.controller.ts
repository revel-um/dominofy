import { Controller, Get, Query, Req } from '@nestjs/common';
import { BaseController } from 'src/common/base.controller';
import { Project } from './projects.entity';
import { CreateProjectDto } from './projects.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController extends BaseController<
    Project,
    Partial<CreateProjectDto>,
    Partial<CreateProjectDto>,
    string,
    ProjectsService
> {
    constructor(
        private readonly projectsService: ProjectsService,
    ) {
        super(projectsService, CreateProjectDto);
    }

    @Get()
    async findAllProjects(@Req() req: Request, @Query('query') query?: string, @Query('limit') limit?: number, @Query('offset') offset?: number) {
        const id = (req as any).user.id;
        const [data, count] = await this.projectsService.findAll(id, limit ?? 10, offset ?? 0, query);
        return {
            data,
            count,
        }
    }

    protected async beforeCreate(dto: CreateProjectDto & { user: string }, req: Request) {
        dto.user = (req as any).user.id;
        return dto;
    }
}
