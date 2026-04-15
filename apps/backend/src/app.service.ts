import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, fromEvent } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { PipelineStep } from '../../../shared/types/pipelineStepType';
import { buildPipeline } from '../../../shared/helpers/buildPipeline';

import { WorkflowService } from './workflow/workflow.service';
import { WorkflowLoggerService } from 'src/workflow-logger/workflow-logger.service';
import { WorkflowLogStatus } from 'src/workflow-logger/workflow-log-status.enum';
import { ExecutionService } from 'src/workflow/execution.service';
import { ExecutionStatus } from 'src/workflow/execution.entity';

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
    private readonly executionService: ExecutionService,
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
      const executedAt = new Date();
      let executionId: string | null = null;
      let failureReason: string | null = null;
      const logRunFailure = async (message: string, stack?: string) => {
        if (!executionId) return;
        failureReason = failureReason ?? message;
        await this.workflowLogger.logLine({
          executionId,
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

      const bootExecution = async () => {
        const execution = await this.executionService.markStarted({
          workflowId,
          runId,
          executedAt,
          isDeployed: false,
        });
        executionId = execution.id;
      };

      const finalizeExecution = async (
        status: ExecutionStatus.SUCCESS | ExecutionStatus.FAILURE,
      ) => {
        await this.executionService.markCompleted({
          workflowId,
          runId,
          executedAt,
          isDeployed: false,
          status,
          failureReason,
        });
      };

      if (isBlocking) {
        let seq = 0;
        if (execPool.queueSize >= MAX_QUEUE_LEN) {
          subscriber.error(
            new HttpException('Server busy – retry soon', HttpStatus.TOO_MANY_REQUESTS)
          );
          return;
        }

        bootExecution().then(() => {
          execPool.run({ workflowId, runId, visualJson: pipeline, mockInput }).catch(async err => {
            const message = err instanceof Error ? err.message : String(err);
            await logRunFailure(message, err instanceof Error ? err.stack : undefined);
            await this.workflowLogger.flushNow();
            await finalizeExecution(ExecutionStatus.FAILURE);
            send({ type: 'RUN_ERROR', error: { message } });
            subscriber.complete();
          });
        }).catch((err) => {
          subscriber.error(err);
        });

        const sub = fromEvent(progressEmitter, runId).subscribe(async (msg: any) => {
          switch (msg.type) {
            case 'NODE_DONE': {
              const { domino } = msg;
              const type = domino.id.split('-')[0];
              if (type === 'print' && executionId) {
                this.workflowLogger.logLine({
                  executionId,
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
              failureReason = failureReason ?? message;
              if (executionId) {
                this.workflowLogger.logLine({
                  executionId,
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
                .then(() =>
                  finalizeExecution(
                    failureReason ? ExecutionStatus.FAILURE : ExecutionStatus.SUCCESS,
                  ),
                )
                .catch(err => subscriber.error(err))
                .finally(() => subscriber.complete());
              break;
          }
        });

        // initial ACK with runId
        send({ type: 'ACCEPTED' });
        return () => sub.unsubscribe();
      }

      let runner: ReturnType<RunnerLauncherService['createRunner']> | null = null;

      bootExecution().then(() => {
        runner = this.runnerLauncherService.createRunner(
          workflowId,
          runId,
          pipeline,
          20,
          wf.visualJson,
          { executionId: executionId! }
        );

        runner.on('done', (res) => {
          send(res);
        });

        runner.on('error', ({ nodeId, error }) => {
          const message = error instanceof Error ? error.message : String(error);
          failureReason = failureReason ?? message;
          send({ nodeId, error });
        });

        runner.on('terminate', () => {
          this.workflowLogger.flushNow()
            .then(() =>
              finalizeExecution(
                failureReason ? ExecutionStatus.FAILURE : ExecutionStatus.SUCCESS,
              ),
            )
            .catch(err => subscriber.error(err))
            .finally(() => subscriber.complete());
        });
        runner.run(runId, mockInput, { workflowId }).catch(async err => {
          const message = err instanceof Error ? err.message : String(err);
          await logRunFailure(message, err instanceof Error ? err.stack : undefined);
          await finalizeExecution(ExecutionStatus.FAILURE);
          send({ type: 'RUN_ERROR', error: { message } });
          subscriber.complete();
        });

        send({ type: 'ACCEPTED' });
      }).catch((err) => {
        subscriber.error(err);
      });

      return () => runner?.removeAllListeners();
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
