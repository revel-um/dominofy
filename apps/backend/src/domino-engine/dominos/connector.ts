// apps/backend/src/dominos/connector.domino.ts
import { PipelineStep } from '../../../../../shared/types/pipelineStepType';
import {
  DominoExecutable,
  ExecuteContext,
  DominoResult,
} from '../domino-engine.type';

/* ------------------------------------------------------------------ */
/*                         CONNECTOR / MERGER                         */
/* ------------------------------------------------------------------ */
export class ConnectorDomino implements DominoExecutable {
  id: string;
  readonly type = 'connector';

  /** Number of exec-in pins this node exposes (counted once in ctor) */
  private readonly expectedCount: number;

  constructor(node: PipelineStep) {
    this.id = node.id;

    /* NOTE: fields live under `details.fields`, not `data.fields` */
    const fields = (node.data?.fields ?? []) as any[];

    this.expectedCount =
      fields.filter(f =>
        String(f.inPinId || '').startsWith('exec_in'),
      ).length || 1; // legacy fallback

    // Defensive log (optional)
    // console.debug(`[ConnectorDomino] ${this.id} expects ${this.expectedCount} branches`);
  }

  /** Wait for *expectedCount* arrivals, then continue via exec_out */
  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    /* ------------------- 1️⃣  Track arrivals & merge data ----------- */
    const arrived = (ctx.local.arrived ?? 0) + 1;
    ctx.setLocal('arrived', arrived);

    const merged = { ...(ctx.local.stash ?? {}), ...(ctx.input ?? {}) };
    ctx.setLocal('stash', merged);

    /* ------------------- 2️⃣  Still waiting for branches? ----------- */
    if (arrived < this.expectedCount) {
      return {
        id: this.id,
        output: null,
        startedAt,
        finishedAt: Date.now(),
        done: false,        // tell runner to pause
        // no nextChainKeys → runner will NOT fire exec_out yet
      };
    }

    /* ------------------- 3️⃣  Barrier passed – forward -------------- */
    ctx.setLocal('arrived', undefined); // clear scratch-pad for this run
    ctx.setLocal('stash', undefined);

    return {
      id: this.id,
      output: merged,              // merged payload
      nextChainKeys: ['exec_out'], // fire exec_out edges
      startedAt,
      finishedAt: Date.now(),
      done: true,
    };
  }
}

export default ConnectorDomino;
