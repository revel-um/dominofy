// domino-engine/dominos/print.domino.ts
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

/**
 * A no-op data sink that simply logs its input (or a formatted template) and
 * passes the input straight through to the next domino.
 *
 * Example node.data:
 *   {
 *     "Message": { "value": "User {{name}} spent ${{amount}}" }
 *   }
 */
export class PrintDomino implements DominoExecutable {
  id: string;
  type = "print" as const;

  /** Optional Handlebars-style template from node.data */
  private template?: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.template = node.data.Text.value;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const msg = this.render(ctx.input);

    // You might swap console.log for a Winston logger, Sentry breadcrumb, etc.
    /* eslint-disable-next-line no-console */
    console.log(`[Domino:${this.id}] ${msg}`);

    // Pass the original input forward unchanged
    return {
      id: this.id,
      output: ctx.input,
      startedAt,
      finishedAt: Date.now(),
    };
  }

  /**
   * Very small {{placeholder}} resolver.  If the template is absent, stringify
   * the whole input object in a readable way.
   */
  private render(input: Record<string, any>) {
    if (!this.template) {
      return JSON.stringify(input, null, 2);
    }

    return this.template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
      key in input ? String(input[key]) : ""
    );
  }
}
