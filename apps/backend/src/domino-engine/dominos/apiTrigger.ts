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

    // Unwrap common request-body wrappers so downstream nodes receive the payload directly.
    if (
      Object.keys(cleanedOutput).length === 1 &&
      'body' in cleanedOutput &&
      cleanedOutput.body !== undefined
    ) {
      return {
        id: this.id,
        output:
          typeof cleanedOutput.body === 'object' && cleanedOutput.body !== null
            ? cleanedOutput.body
            : { body: cleanedOutput.body },
        startedAt,
        finishedAt: Date.now(),
      };
    }

    if (
      cleanedOutput['Text'] &&
      typeof cleanedOutput['Text'] === 'object' &&
      cleanedOutput['Text'].body !== undefined
    ) {
      cleanedOutput.body = cleanedOutput['Text'].body;
      delete cleanedOutput['Text'];
    }

    return {
      id: this.id,
      output: cleanedOutput,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
