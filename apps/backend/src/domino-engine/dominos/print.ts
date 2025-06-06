// domino-engine/dominos/print.domino.ts
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class PrintDomino implements DominoExecutable {
  id: string;
  type = "print" as const;
  private literalTemplate?: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalTemplate = node.data?.Text?.value;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    // Try to use dynamic template from input, else fallback to literal
    const dynamicTemplate = ctx.input.Text;
    const rawTemplate = typeof dynamicTemplate === "string" ? dynamicTemplate : this.literalTemplate;
    const msg = this.render(rawTemplate, ctx.input);
    // console.log(`[PrintDomino:${this.id}] ${msg}`);
    return {
      id: this.id,
      output: ctx.input.Text,
      startedAt,
      finishedAt: Date.now(),
    };
  }

  private render(template: string | undefined, input: Record<string, any>): string {
    if (!template) {
      // If no template string, just print the entire input object
      return JSON.stringify(input, null, 2);
    }
    // Template is a string; replace placeholders
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
      key in input ? String(input[key]) : ""
    );
  }
}
