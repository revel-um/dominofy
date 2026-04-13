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

interface PendingRunSession {
  workflowId: string;
  userId: string;
  mockInput: Record<string, any>;
  createdAt: number;
}

@Injectable()
export class AppService {
  private readonly pendingRunSessions = new Map<string, PendingRunSession>();
  private readonly pendingRunSessionTtlMs = 10 * 60 * 1000;

  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowLogger: WorkflowLoggerService,
    private readonly runnerLauncherService: RunnerLauncherService,
  ) { }

  async createRunSession(
    workflowId: string,
    userId: string,
    mockInput: Record<string, any> = {},
  ) {
    await this.workflowService.findOneAndVerify(workflowId, userId);
    this.prunePendingRunSessions();

    const runToken = uuidv4();
    this.pendingRunSessions.set(runToken, {
      workflowId,
      userId,
      mockInput: this.normalizeMockInput(mockInput),
      createdAt: Date.now(),
    });

    return { runToken };
  }

  async dominofyEvent(workflowId: string, userId: string, runToken?: string) {
    const wf = await this.workflowService.findOneAndVerify(workflowId, userId);
    if (!wf?.visualJson?.edges?.length) return;
    const mockInput = this.consumeRunSession(workflowId, userId, runToken);

    const { nodes, edges } = wf.visualJson;
    const pipeline: PipelineStep[] = buildPipeline(nodes, edges);

    return new Observable(subscriber => {
      const runId = uuidv4();
      const logRunFailure = async (message: string, stack?: string) => {
        await this.workflowLogger.logLine({
          workflowId,
          type: 'workflow',
          runId,
          dominoId: '__workflow__',
          status: WorkflowLogStatus.FAILURE,
          error: { message, stack },
        });
        await this.workflowLogger.flushNow();
      };

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

        
        execPool.run({ workflowId, runId, visualJson: pipeline, mockInput }).catch(async err => {
          const message = err instanceof Error ? err.message : String(err);
          await logRunFailure(message, err instanceof Error ? err.stack : undefined);
          send({ type: 'RUN_ERROR', error: { message } });
          subscriber.complete();
        });

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
              this.workflowLogger.logLine({
                workflowId,
                type,
                runId,
                dominoId: nodeId,
                status: WorkflowLogStatus.FAILURE,
                error: { message },
                seq: seq++,
              });
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
      runner.run(runId, mockInput, { workflowId }).catch(async err => {
        const message = err instanceof Error ? err.message : String(err);
        await logRunFailure(message, err instanceof Error ? err.stack : undefined);
        send({ type: 'RUN_ERROR', error: { message } });
        subscriber.complete();
      });

      send({ type: 'ACCEPTED' });
      return () => runner.removeAllListeners();
    });
  }

  dominofy(pipeline: PipelineStep[]) {
    return pipeline;
  }

  private consumeRunSession(
    workflowId: string,
    userId: string,
    runToken?: string,
  ): Record<string, any> {
    this.prunePendingRunSessions();
    if (!runToken) return {};

    const session = this.pendingRunSessions.get(runToken);
    if (!session) return {};
    this.pendingRunSessions.delete(runToken);

    if (session.workflowId !== workflowId || session.userId !== userId) {
      return {};
    }

    return session.mockInput;
  }

  private prunePendingRunSessions() {
    const now = Date.now();
    for (const [token, session] of this.pendingRunSessions.entries()) {
      if (now - session.createdAt > this.pendingRunSessionTtlMs) {
        this.pendingRunSessions.delete(token);
      }
    }
  }

  private normalizeMockInput(value: any): any {
    if (Array.isArray(value)) {
      return value.map((entry) => this.normalizeMockInput(entry));
    }

    if (value && typeof value === 'object') {
      if (typeof value.bufferBase64 === 'string') {
        const { bufferBase64, ...rest } = value;
        return {
          ...Object.fromEntries(
            Object.entries(rest).map(([key, entry]) => [key, this.normalizeMockInput(entry)]),
          ),
          buffer: Buffer.from(bufferBase64, 'base64'),
        };
      }

      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, this.normalizeMockInput(entry)]),
      );
    }

    return value;
  }
}
