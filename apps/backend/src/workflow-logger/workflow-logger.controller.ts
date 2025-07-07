import {
    Controller,
    Get,
    Param,
    Query,
    Req,
} from '@nestjs/common';
import { Request } from 'express';
import { WorkflowLoggerService } from './workflow-logger.service';
import { WorkflowService } from '../workflow/workflow.service';
import { WorkflowLog } from './workflow-logger.entity';
import { CreateWorkflowLogDto } from './workflow-logger.dto';
import { BaseController } from 'src/common/base.controller';

@Controller('workflows/:workflowId/logs')
export class WorkflowLoggerController extends BaseController<
    WorkflowLog,
    Partial<CreateWorkflowLogDto>,
    Partial<CreateWorkflowLogDto>,
    string,
    WorkflowLoggerService
> {
    constructor(
        private readonly loggerService: WorkflowLoggerService,
        private readonly workflowService: WorkflowService,
    ) {
        super(loggerService, CreateWorkflowLogDto);
    }

    /**
     * Fetch logs for a given workflow and optional run instance.
     * Verifies that the requesting user has access to the workflow.
     * Supports pagination and text search on outputs.
     */
    @Get()
    async fetchLogs(
        @Param('workflowId') workflowId: string,
        @Req() req: Request,
        @Query('runId') runId?: string,
        @Query('limit') limit = '50',
        @Query('offset') offset = '0',
        @Query('search') search?: string,
        @Query('minutes') minutes = '0',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ): Promise<{ count: number; logs: WorkflowLog[] }> {
        console.log('logger fetch')
        // 1. Verify workflow ownership
        const userId = (req as any).user.id;
        await this.workflowService.findOneAndVerify(workflowId, userId);

        // 2. Normalize numeric params
        const limitNum = Number(limit);
        const offsetNum = Number(offset);
        const minutesNum = Number(minutes);

        let logsResult: [WorkflowLog[], number];

        // 3. Branch: date‐range vs minutes
        if (startDate && endDate) {
            // Parse ISO‐strings into Date objects
            const start = new Date(startDate);
            const end = new Date(endDate);
            logsResult = await this.loggerService.findAllByDateRange(
                workflowId,
                runId,
                limitNum,
                offsetNum,
                search,
                start,
                end,
            );
        } else {
            logsResult = await this.loggerService.findAll(
                workflowId,
                runId,
                limitNum,
                offsetNum,
                search,
                minutesNum,
            );
        }

        const [logs, count] = logsResult;
        return { count, logs };
    }

}
