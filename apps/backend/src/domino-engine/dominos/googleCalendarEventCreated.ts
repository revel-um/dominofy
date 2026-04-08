import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class GoogleCalendarEventCreatedDomino implements DominoExecutable {
  id: string;
  type = "googleCalendarEventCreated" as const;
  isTrigger = true;

  constructor(node: PipelineStep) {
    this.id = node.id;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    return {
      id: this.id,
      output: { ...(ctx.input ?? {}) },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
