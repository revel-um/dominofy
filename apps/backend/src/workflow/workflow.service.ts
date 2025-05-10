import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Workflow } from './workflow.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class WorkflowService extends BaseService<Workflow> {
    constructor(
        @InjectRepository(Workflow)
        private readonly workflowRepository: Repository<Workflow>,
    ) {
        super(workflowRepository);
    }
}
