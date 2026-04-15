import {
    Controller,
    Get,
    Param,
    Query,
    Req,
    Sse,
} from '@nestjs/common';
import { Request } from 'express';
import { from, mergeMap } from 'rxjs';
import { WorkflowLoggerService } from './workflow-logger.service';
import { WorkflowService } from '../workflow/workflow.service';
import { WorkflowLog } from './workflow-logger.entity';
import { CreateWorkflowLogDto } from './workflow-logger.dto';
import { BaseController } from 'src/common/base.controller';
import { ExecutionService } from 'src/workflow/execution.service';

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
        private readonly executionService: ExecutionService,
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
    ): Promise<{ count: number; logs: Array<WorkflowLog | any> }> {
        const userId = (req as any).user.id;
        const target = await this.workflowService.resolveLogAccessTarget(workflowId, userId);

        // 2. Normalize numeric params
        const limitNum = Number(limit);
        const offsetNum = Number(offset);
        const minutesNum = Number(minutes);

        let logsResult: [Array<WorkflowLog | any>, number];

        // 3. Branch: date‐range vs minutes
        if (startDate && endDate) {
            // Parse ISO‐strings into Date objects
            const start = new Date(startDate);
            const end = new Date(endDate);
            logsResult = await this.loggerService.findAllByDateRange(
                target,
                runId,
                limitNum,
                offsetNum,
                search,
                start,
                end,
            );
        } else {
            logsResult = await this.loggerService.findAll(
                target,
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

    @Sse('stream')
    streamLogs(
        @Param('workflowId') workflowId: string,
        @Req() req: Request,
        @Query('runId') runId?: string,
    ) {
        const userId = (req as any).user.id;
        return from(this.workflowService.resolveLogAccessTarget(workflowId, userId)).pipe(
            mergeMap((target) => this.loggerService.streamLogs(target, runId)),
        );
    }

    @Get('/by-execution/:executionId')
    async fetchExecutionLogs(
        @Param('executionId') executionId: string,
        @Req() req: Request,
        @Query('limit') limit = '200',
        @Query('offset') offset = '0',
    ): Promise<{ count: number; logs: Array<WorkflowLog | any>; execution: any }> {
        const userId = (req as any).user.id;
        const execution = await this.executionService.findOneForUser(executionId, userId);
        const [logs, count] = await this.loggerService.findAllByExecution(
            execution.id,
            execution.isDeployed,
            Number(limit),
            Number(offset),
        );

        return { count, logs, execution };
    }

}
