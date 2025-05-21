import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Workflow } from './workflow.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from 'src/user/user.service';

@Injectable()
export class WorkflowService extends BaseService<Workflow> {
    constructor(
        @InjectRepository(Workflow)
        private readonly workflowRepository: Repository<Workflow>,
        private readonly userService: UserService
    ) {
        super(workflowRepository);
    }

    async countAllWorkflows(userId: string) {
        return this.workflowRepository.count({ where: { user: { id: userId } } })
    }

    async getRecentWorkflows(userId: string) {
        const user = await this.userService.findOne(userId);
        if (!user) return;

        const [workflows, count] = await this.workflowRepository.findAndCount({
            where: { user: { id: userId } },
            order: { updatedAt: 'DESC' },
            take: 1
        });

        return { workflows, count, user };
    }
}
