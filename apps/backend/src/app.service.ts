import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, fromEvent } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { PipelineStep } from '../../../shared/types/pipelineStepType';
import { buildPipeline } from '../../../shared/helpers/buildPipeline';

import { WorkflowService } from './workflow/workflow.service';
import { WorkflowLoggerService } from 'src/workflow-logger/workflow-logger.service';
import { WorkflowLogStatus } from 'src/workflow-logger/workflow-logger.entity';

import {
  execPool,
  MAX_QUEUE_LEN,
  HeavyTaskInput,
  progressEmitter,
} from './heavy-lifter/exec-pool.util';
import { Runner } from './domino-engine/runner';

const CPU_INTENSIVE = true;          // flip to false for local inline testing

@Injectable()
export class AppService {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowLogger: WorkflowLoggerService,
  ) {}

  async dominofyEvent(workflowId: string, userId: string) {
    const wf = await this.workflowService.findOneAndVerify(workflowId, userId);
    if (!wf?.visualJson?.edges?.length) return;

    const { nodes, edges } = wf.visualJson;
    const pipeline: PipelineStep[] = buildPipeline(nodes, edges);

    return new Observable(subscriber => {
      const runId = uuidv4();
      console.log('started run', { runId });

      /* ─────────── worker-thread path ─────────── */
      if (CPU_INTENSIVE) {
        if (execPool.queueSize >= MAX_QUEUE_LEN) {
          subscriber.error(
            new HttpException('Server busy – retry soon', HttpStatus.TOO_MANY_REQUESTS),
          );
          return;
        }

        const payload: HeavyTaskInput = { workflowId, runId, visualJson: pipeline };
        execPool.run(payload).catch(err => subscriber.error(err));

        /* Map worker messages → inline-style SSE & DB logs */
        const sub = fromEvent(progressEmitter, runId).subscribe((msg: any) => {
          switch (msg.type) {
            case 'NODE_DONE': {
              const { domino } = msg;
              const type = domino.id.split('-')[0];
              /* DB log */
              this.workflowLogger.logLine({
                workflowId,
                type,
                runId,
                dominoId: domino.id,
                status: WorkflowLogStatus.SUCCESS,
                output: type === 'print' ? domino.output : undefined,
              });
              /* SSE payload identical to inline path */
              subscriber.next(JSON.stringify(domino));
              break;
            }
            case 'NODE_ERROR': {
              const { nodeId, message } = msg;
              const type = nodeId.split('-')[0];
              this.workflowLogger.logLine({
                workflowId,
                type,
                runId,
                dominoId: nodeId,
                status: WorkflowLogStatus.FAILURE,
                error: { message },
              });
              subscriber.next(JSON.stringify({ nodeId, error: { message } }));
              break;
            }
            case 'DONE':   // emitted when heavyTask resolves
              subscriber.complete();
              break;
          }
        });

        /* Immediate ACK so UI shows spinner */
        subscriber.next(JSON.stringify({ runId, type: 'ACCEPTED' }));
        return () => sub.unsubscribe();
      }

      /* ─────────── inline path (CPU_INTENSIVE = false) ─────────── */
      const runner = new Runner(pipeline, 20);

      runner.on('done', (res) => {
        const type = res.id.split('-')[0];
        this.workflowLogger.logLine({
          workflowId,
          type,
          runId,
          dominoId: res.id,
          status: WorkflowLogStatus.SUCCESS,
          output: type === 'print' ? res.output : undefined,
        });
        subscriber.next(JSON.stringify(res));
      });

      runner.on('error', ({ nodeId, error }) => {
        const type = nodeId.split('-')[0];
        this.workflowLogger.logLine({
          workflowId,
          type,
          runId,
          dominoId: nodeId,
          status: WorkflowLogStatus.FAILURE,
          error: { message: error?.message, stack: error?.stack },
        });
        subscriber.next(JSON.stringify({ nodeId, error }));
      });

      runner.on('terminate', () => subscriber.complete());
      runner.run(runId).catch(err => subscriber.error(err));

      subscriber.next(JSON.stringify({ runId, type: 'ACCEPTED' }));
      return () => runner.removeAllListeners();
    });
  }

  dominofy(pipeline: PipelineStep[]) {
    return pipeline;
  }
}
