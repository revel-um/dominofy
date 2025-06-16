import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class ApiTriggerDomino implements DominoExecutable {
  id: string;
  type = "apitrigger";
  isTrigger = true

  private configKeys = ['Function', 'Require Body', 'Require File Upload'];

  constructor(node: PipelineStep) {
    this.id = node.id;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    const cleanedOutput: Record<string, any> = {};

    // 1️⃣ Keep top-level non-config keys only
    Object.entries(ctx.input).forEach(([key, value]) => {
      if (!this.configKeys.includes(key)) {
        cleanedOutput[key] = value;
      }
    });

    // 2️⃣ If you have a known redundant wrapper pin (like Text),
    // and it also holds a nested { body }, unwrap it:
    if (
      cleanedOutput['Text'] &&
      typeof cleanedOutput['Text'] === 'object' &&
      cleanedOutput['Text'].body
    ) {
      // Merge Text.body into cleanedOutput.body
      cleanedOutput.body = cleanedOutput['Text'].body;

      // Optionally delete the redundant Text field
      delete cleanedOutput['Text'];
      console.log(cleanedOutput)
    }

    return {
      id: this.id,
      output: cleanedOutput,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
