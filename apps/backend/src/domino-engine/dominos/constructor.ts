import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

type ConstructorEntry = {
  key: string;
  value: unknown;
};

export class ConstructorDomino implements DominoExecutable {
  id: string;
  type = "constructor" as const;

  constructor(private node: PipelineStep) {
    this.id = node.id;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const entries = this.collectEntries(ctx);
    const output = entries.reduce<Record<string, unknown>>((acc, entry) => {
      acc[entry.key] = entry.value;
      return acc;
    }, {});

    return {
      id: this.id,
      output,
      startedAt,
      finishedAt: Date.now(),
    };
  }

  private literal<T = any>(key: string): T | undefined {
    return (this.node.data as any)?.[key]?.value as T | undefined;
  }

  private collectEntries(ctx: ExecuteContext): ConstructorEntry[] {
    const keys = Object.keys(this.node.data)
      .filter(key => /^Key_\d+$/.test(key))
      .sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]));

    return keys
      .map((keyField) => {
        const idx = keyField.split("_")[1];
        const valueField = `Value_${idx}`;
        const key = String(ctx.input?.[keyField] ?? this.literal(keyField) ?? '').trim();
        const value = ctx.input?.[valueField] ?? this.literal(valueField);

        return { key, value };
      })
      .filter((entry) => entry.key.length > 0);
  }
}
