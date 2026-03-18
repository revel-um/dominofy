import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class JoinTextDomino implements DominoExecutable {
  id: string;
  type = "jointext" as const;

  private inputKeys: string[];
  private literalInputs: string[];

  constructor(node: PipelineStep) {
    this.id = node.id;
    const data = node.data || {};

    this.inputKeys = Object.keys(data)
      .filter((key) => key.startsWith("Input_"))
      .sort((a, b) => {
        const idxA = parseInt(a.split("_")[1], 10);
        const idxB = parseInt(b.split("_")[1], 10);
        return idxA - idxB;
      });

    this.literalInputs = this.inputKeys.map((key) =>
      String(data[key]?.value ?? "")
    );
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const output = this.inputKeys
      .map((key, index) => {
        const override = ctx.input[key];
        return String(override ?? this.literalInputs[index] ?? "");
      })
      .join("");

    return {
      id: this.id,
      output,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
