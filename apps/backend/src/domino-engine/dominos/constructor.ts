import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

type ConstructorEntry = {
  key: string;
  value: unknown;
};

type ConstructorValueType = "string" | "number" | "boolean" | "json";

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

  private coerceLiteralValue(rawValue: unknown, valueType: ConstructorValueType): unknown {
    if (rawValue === undefined || rawValue === null) return rawValue;
    if (valueType === "string") return rawValue;

    const normalized =
      typeof rawValue === "string" ? rawValue.trim().toLowerCase() : rawValue;

    if (valueType === "boolean") {
      if (typeof normalized === "boolean") return normalized; 
      if (normalized === "true") return true;
      if (normalized === "false") return false;
      return rawValue;
    }

    if (valueType === "number") {
      if (typeof rawValue === "number") return rawValue;
      if (typeof rawValue === "string" && rawValue.trim() === "") return rawValue;
      const parsed = Number(rawValue);
      return Number.isNaN(parsed) ? rawValue : parsed;
    }

    if (valueType === "json") {
      if (typeof rawValue !== "string") return rawValue;
      const trimmed = rawValue.trim();
      if (trimmed === "") return rawValue;

      try {
        return JSON.parse(trimmed);
      } catch {
        return rawValue;
      }
    }

    return rawValue;
  }

  private collectEntries(ctx: ExecuteContext): ConstructorEntry[] {
    const keys = Object.keys(this.node.data)
      .filter(key => /^Key_\d+$/.test(key))
      .sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]));

    return keys
      .map((keyField) => {
        const idx = keyField.split("_")[1];
        const valueField = `Value_${idx}`;
        const valueTypeField = `ValueType_${idx}`;
        const key = String(ctx.input?.[keyField] ?? this.literal(keyField) ?? '').trim();
        const literalValue = this.literal(valueField);
        const valueType =
          (this.literal<ConstructorValueType>(valueTypeField) ?? "string") as ConstructorValueType;
        const rawValue =
          ctx.input?.[valueField] !== undefined ? ctx.input[valueField] : literalValue;
        const value = this.coerceLiteralValue(rawValue, valueType);

        return { key, value };
      })
      .filter((entry) => entry.key.length > 0);
  }
}
