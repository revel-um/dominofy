import { Piscina } from 'piscina';          // ← changed
import * as os from 'os';
import { join } from 'path';
import { EventEmitter } from 'events';
import { PipelineStep } from '../../../../shared/types/pipelineStepType';

/* ------------------------------------------------------------------ */

export const progressEmitter = new EventEmitter();

export const MAX_THREADS   = Math.max(1, os.cpus().length - 1);
export const MAX_QUEUE_LEN = 250;

export interface HeavyTaskInput {
  runId: string;
  visualJson: PipelineStep[];
  workflowId: string;
  mockInput?: Record<string, any>;
}

export interface HeavyTaskProgress {
  runId: string;
  type: 'PROGRESS';
  pct: number;
}

export interface HeavyTaskDone {
  runId: string;
  type: 'DONE';
  ms: number;
  output: unknown;
}

export const execPool = new Piscina({
  filename: join(__dirname, 'heavy-task.js'),
  maxThreads: MAX_THREADS,
  concurrentTasksPerWorker: 1,
  maxQueue: MAX_QUEUE_LEN,
  idleTimeout: 10_000,
});

execPool.on('message', (msg: HeavyTaskProgress | HeavyTaskDone) => {
  progressEmitter.emit(msg.runId, msg);
});
