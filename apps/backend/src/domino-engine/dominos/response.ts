import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class ResponseDomino implements DominoExecutable {
  id: string;
  type = "response" as const;

  private literalResponse: any;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalResponse = node.data?.Response?.value ?? "";
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const output =
      Object.prototype.hasOwnProperty.call(ctx.input ?? {}, "Response")
        ? ctx.input.Response
        : this.literalResponse;

    return {
      id: this.id,
      output,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
