// src/workflow/services/runner-launcher.service.ts
import { Injectable } from '@nestjs/common';
import { PipelineStep } from '../types/pipelineStepType';
import { WorkflowLogStatus } from 'src/workflow-logger/workflow-logger.entity';
import { WorkflowLoggerService } from 'src/workflow-logger/workflow-logger.service';
import { Runner } from '../domino-engine/runner';

@Injectable()
export class RunnerLauncherService {
  constructor(private readonly logger: WorkflowLoggerService) {}

  /**
   * Creates a Runner, wires logging, and returns it.
   * Caller is responsible for invoking runner.run().
   */
  createRunner(
    workflowId: string,
    runId: string,
    pipeline: PipelineStep[],
    maxConc = 20,
    visualJson: any,
    options?: { deployedWorkflowId?: string },
  ): Runner {
    const runner = new Runner(pipeline, maxConc, visualJson);

    /* per-run monotonically-increasing sequence counter ––––––––– */
    let seq = 0;                                         // NEW

    /* SUCCESS listener */
    runner.on('done', (res: any) => {
      const type = res.id.split('-')[0];                 // e.g. 'print'
      if (type === 'print' || type === 'response') {
        this.logger.logLine({
          workflowId,
          deployedWorkflowId: options?.deployedWorkflowId,
          type,
          runId,
          dominoId: res.id,
          status: WorkflowLogStatus.SUCCESS,
          output: res.output,
          seq: seq++,                                      // NEW
        });
      }
    });

    /* FAILURE listener */
    runner.on('error', ({ nodeId, error }) => {
      const type = nodeId.split('-')[0];
      this.logger.logLine({
        workflowId,
        deployedWorkflowId: options?.deployedWorkflowId,
        type,
        runId,
        dominoId: nodeId,
        status: WorkflowLogStatus.FAILURE,
        error: { message: error?.message, stack: error?.stack },
        seq: seq++,                                      // NEW
      });
    });

    return runner;
  }
}
