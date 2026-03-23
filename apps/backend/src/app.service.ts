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
  progressEmitter,
} from './heavy-lifter/exec-pool.util';
import { isWorkflowBlocking } from './heavy-lifter/block-checker';
import { RunnerLauncherService } from './runner-launcher/runner-launcher.service';

@Injectable()
export class AppService {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowLogger: WorkflowLoggerService,
    private readonly runnerLauncherService: RunnerLauncherService,
  ) { }

  async dominofyEvent(workflowId: string, userId: string) {
    const wf = await this.workflowService.findOneAndVerify(workflowId, userId);
    if (!wf?.visualJson?.edges?.length) return;

    const { nodes, edges } = wf.visualJson;
    const pipeline: PipelineStep[] = buildPipeline(nodes, edges);

    return new Observable(subscriber => {
      const runId = uuidv4();

      const isBlocking = isWorkflowBlocking(pipeline);

      // common helper to wrap and JSON-stringify + include runId
      const send = (payload: any) =>
        subscriber.next(JSON.stringify({ ...payload, runId }));

      if (isBlocking) {
        let seq = 0;
        if (execPool.queueSize >= MAX_QUEUE_LEN) {
          subscriber.error(
            new HttpException('Server busy – retry soon', HttpStatus.TOO_MANY_REQUESTS)
          );
          return;
        }

        
        execPool.run({ workflowId, runId, visualJson: pipeline }).catch(err => subscriber.error(err));

        const sub = fromEvent(progressEmitter, runId).subscribe((msg: any) => {
          switch (msg.type) {
            case 'NODE_DONE': {
              const { domino } = msg;
              const type = domino.id.split('-')[0];
              if (type === 'print') {
                this.workflowLogger.logLine({
                  workflowId,
                  type,
                  runId,
                  dominoId: domino.id,
                  status: WorkflowLogStatus.SUCCESS,
                  output: domino.output,
                  seq: seq++,
                });
              }
              // include runId on SSE
              send(domino);
              break;
            }
            case 'NODE_ERROR': {
              const { nodeId, message } = msg;
              const type = nodeId.split('-')[0];
              if (type === 'print') {
                this.workflowLogger.logLine({
                  workflowId,
                  type,
                  runId,
                  dominoId: nodeId,
                  status: WorkflowLogStatus.FAILURE,
                  error: { message },
                  seq: seq++,
                });
              }
              send({ nodeId, error: { message } });
              break;
            }
            case 'DONE':
              this.workflowLogger.flushNow()
                .catch(err => subscriber.error(err))
                .finally(() => subscriber.complete());
              break;
          }
        });

        // initial ACK with runId
        send({ type: 'ACCEPTED' });
        return () => sub.unsubscribe();
      }

      // inline path
      const runner = this.runnerLauncherService.createRunner(
        workflowId,
        runId,
        pipeline,
        20,
        wf.visualJson
      );

      runner.on('done', (res) => {
        // res usually contains domino info; include runId
        send(res);
      });

      runner.on('error', ({ nodeId, error }) => {
        send({ nodeId, error });
      });

      runner.on('terminate', () => {
        this.workflowLogger.flushNow()
          .catch(err => subscriber.error(err))
          .finally(() => subscriber.complete());
      });
      runner.run(runId, {}, { workflowId }).catch(err => subscriber.error(err));

      send({ type: 'ACCEPTED' });
      return () => runner.removeAllListeners();
    });
  }

  dominofy(pipeline: PipelineStep[]) {
    return pipeline;
  }
}
