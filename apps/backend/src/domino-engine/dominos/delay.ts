import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class DelayDomino implements DominoExecutable {
  id: string;
  type = "delay" as const;

  private delayMs: number;

  constructor(private node: PipelineStep) {
    this.id = node.id;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    
    // Accept dynamic delay from input pins if provided
    const delayMs = ctx.input.Delay ?? this.delayMs;
    const input = ctx.input.Input;

    // Create a promise that resolves after the specified delay
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve();
      }, delayMs);

      // Support cancellation via abort signal
      if (ctx.abortSignal) {
        ctx.abortSignal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Delay cancelled'));
        });
      }
    });

    return {
      id: this.id,
      output: input, // Pass through the input unchanged
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
