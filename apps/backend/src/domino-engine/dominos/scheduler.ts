import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, DominoResult, ExecuteContext } from "../domino-engine.type";

/**
 * Backend counterpart of the Scheduler domino.
 * Acts as a trigger node: simply forwards the run context downstream.
 */
export class SchedulerDomino implements DominoExecutable {
  id: string;
  type = "SchedulerDomino";

  constructor(node: PipelineStep) {
    this.id = node.id;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    return {
      id: this.id,
      output: ctx.input ?? {},
      startedAt,
      finishedAt: Date.now(),
      done: true, // nothing to iterate; just trigger downstream
    };
  }
}
