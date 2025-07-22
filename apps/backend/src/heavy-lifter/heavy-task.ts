import { parentPort } from 'worker_threads';
import { HeavyTaskInput, HeavyTaskDone } from './exec-pool.util';
import { PipelineStep } from '../../../../shared/types/pipelineStepType';
import { Runner } from 'src/domino-engine/runner';

/* ───────────────────────── helpers ───────────────────────── */

/** Send a structured-clone-safe message to parent thread */
const emit = (msg: Record<string, any>) => parentPort?.postMessage(msg);

/** Keep only JSON-safe fields the UI / main thread needs */
function toPlainDomino(res: any) {
  return {
    id:         res.id,
    output:     res.output,
    startedAt:  res.startedAt ?? Date.now(),
    finishedAt: res.finishedAt ?? Date.now(),
  };
}

/* ───────────────────────── worker entry ───────────────────────── */

export default async function heavyTask(
  data: HeavyTaskInput,
): Promise<HeavyTaskDone> {
  const { runId, visualJson } = data;
  const start = performance.now();

  /* build pipeline & runner */
  const pipeline: PipelineStep[] = Array.isArray(visualJson) ? visualJson : [];
  const total = pipeline.length || 1;
  const runner = new Runner(pipeline, 20, visualJson);          // no DB logger inside worker

  /* forward events */
  let completed = 0;

  runner.on('done', (res) => {
    completed += 1;

    /* domino result identical to inline path */
    const domino = toPlainDomino(res);
    emit({ runId, type: 'NODE_DONE', domino });

    /* optional progress */
    emit({
      runId,
      type: 'PROGRESS',
      pct: Math.min(99, Math.round((completed / total) * 100)),
    });
  });

  runner.on('error', ({ nodeId, error }) =>
    emit({ runId, type: 'NODE_ERROR', nodeId, message: error?.message }),
  );

  /* execute workflow */
  await runner.run(runId, {});         // {} = globalInput placeholder
  emit({ runId, type: 'PROGRESS', pct: 100 });

  /* resolve promise so execPool.run() finishes */
  return {
    runId,
    type: 'DONE',
    ms: Math.round(performance.now() - start),
    output: { status: 'ok' },
  };
}
