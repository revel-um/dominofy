// src/workflow/services/runner-launcher.service.ts
import { Injectable } from '@nestjs/common';
import { PipelineStep } from '../../../../shared/types/pipelineStepType';
import { WorkflowLogStatus } from 'src/workflow-logger/workflow-logger.entity';
import { WorkflowLoggerService } from 'src/workflow-logger/workflow-logger.service';
import { Runner } from '../domino-engine/runner';

@Injectable()
export class RunnerLauncherService {
  constructor(private readonly logger: WorkflowLoggerService) { }

  /**
   * Launches a pipeline run with logging.
   *
   * @param workflowId  DB id for Workflow (FK in logs table)
   * @param runId       uuid-v4 for this execution instance
   * @param pipeline    parsed Domino pipeline
   * @param globals     global input for triggers
   * @param maxConc     Runner concurrency (default 20)
   */
  launch(
    workflowId: string,
    runId: string,
    pipeline: PipelineStep[],
    maxConc = 20,
  ) {
    /* 1️⃣ create the plain Runner */
    const runner = new Runner(pipeline, maxConc);

    /* 2️⃣ attach SUCCESS listener */
    runner.on('done', (res: any) => {
      this.logger.logLine({
        workflowId,
        runId,
        dominoId: res.nodeId,             // Runner emits nodeId in res
        status: WorkflowLogStatus.SUCCESS,
        output: res.output,
        meta: { durationMs: res.duration },
      });
    });

    /* 3️⃣ attach FAILURE listener */
    runner.on('error', ({ nodeId, error }) => {
      this.logger.logLine({
        workflowId,
        runId,
        dominoId: nodeId,
        status: WorkflowLogStatus.FAILURE,
        error: { message: error?.message, stack: error?.stack },
      });
    });

    /* 4️⃣ run the pipeline */
    return runner;
  }
}
