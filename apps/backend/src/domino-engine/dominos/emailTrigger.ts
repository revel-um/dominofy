import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import {
  DominoExecutable,
  DominoResult,
  ExecuteContext,
} from "../domino-engine.type";

export class EmailTriggerDomino implements DominoExecutable {
  id: string;
  type = "emailtrigger";
  isTrigger = true;

  constructor(node: PipelineStep) {
    this.id = node.id;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const cleaned = { ...(ctx.input || {}) };
    delete (cleaned as any).vaultId;
    delete (cleaned as any).secret;

    return {
      id: this.id,
      output: cleaned,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
