// domino-engine/dominos/print.domino.ts
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class PrintDomino implements DominoExecutable {
  id: string;
  type = "print" as const;
  private template?: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.template = node.data?.Text?.value;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const msg = this.render(ctx.input);
    console.log(`[PrintDomino:${this.id}] ${msg}`);
    return {
      id: this.id,
      output: ctx.input,
      startedAt,
      finishedAt: Date.now(),
    };
  }

  private render(input: Record<string, any>): string {
    if (!this.template) {
      return JSON.stringify(input, null, 2);
    }
    return this.template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
      key in input ? String(input[key]) : ""
    );
  }
}
