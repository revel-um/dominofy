// domino-engine/dominos/apiTrigger.domino.ts
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class ApiTriggerDomino implements DominoExecutable {
  id: string;
  type = "apitrigger" as const;

  constructor(node: PipelineStep) {
    this.id = node.id;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    // You can add logging or validation logic here
    console.log(`[ApiTriggerDomino:${this.id}] Triggered with input:`, ctx.input);

    return {
      id: this.id,
      output: ctx.input,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
