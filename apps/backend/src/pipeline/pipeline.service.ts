import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Pipeline } from './pipeline.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class PipelineService extends BaseService<Pipeline> {
    constructor(
        @InjectRepository(Pipeline)
        private readonly pipelineRepository: Repository<Pipeline>,
    ) {
        super(pipelineRepository);
    }
}
