import { Controller, Get, Query, Req, Post, Body, Put } from '@nestjs/common';
import { BaseController } from 'src/common/base.controller';
import { Project } from './projects.entity';
import { CreateProjectDto } from './projects.dto';
import { ProjectsService } from './projects.service';
import { Request } from 'express';
import { Param } from '@nestjs/common';

@Controller('projects')
export class ProjectsController extends BaseController<
    Project,
    CreateProjectDto,
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
    async list(
        @Req() req: Request,
        @Query('query') query?: string,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number,
    ) {
        const id = (req as any).user.id as string;
        const [data, count] = await this.projectsService.findAll(
            id,
            limit ?? 10,
            offset ?? 0,
            query,
        );
        return { data, count };
    }

    @Get(':id/overview')
    async overview(@Param('id') projectId: string, @Req() req: Request) {
        const userId = (req as any).user.id as string;
        return this.projectsService.getOverview(projectId, userId);
    }

    @Get('overview')
    async globalOverview(@Req() req: Request) {
        const userId = (req as any).user.id as string;
        return this.projectsService.getGlobalOverview(userId);
    }

    @Get(':id/details-with-workflows')
    async getProjectDetailsWithWorkflows(@Param('id') projectId: string, @Req() req: Request) {
        const userId = (req as any).user.id as string;
        return this.projectsService.getProjectDetailsWithWorkflows(projectId, userId);
    }

    @Post('create')
    async createProject(@Body() dto: CreateProjectDto, @Req() req: Request) {
        const userId = (req as any).user.id as string;
        return this.projectsService.createProjectWithDefaultWorkflow(dto, userId);
    }

    @Put(':id')
    async updateProject(@Param('id') projectId: string, @Body() dto: Partial<CreateProjectDto>, @Req() req: Request) {
        const userId = (req as any).user.id as string;
        return this.projectsService.updateProject(projectId, dto, userId);
    }

    protected async beforeCreate(dto: CreateProjectDto, req: Request) {      
        (dto as any).user = (req as any).user.id;
        return dto;
    }
}
