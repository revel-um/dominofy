import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

type RenameRule = { from: string; to: string };

export class MapperDomino implements DominoExecutable {
  id: string;
  type = "mapper" as const;

  constructor(private node: PipelineStep) {
    this.id = node.id;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    const input = ctx.input?.Input;
    const preserveOther: boolean = (ctx.input?.PreserveOtherData ?? true) === true;

    const rules = this.collectRules(ctx);
    let output: unknown;

    if (Array.isArray(input)) {
      // Map only objects; pass through non-objects as-is
      output = input.map((item) =>
        this.isPlainObject(item) ? this.renameObject(item, rules, preserveOther) : item
      );
    } else if (this.isPlainObject(input)) {
      output = this.renameObject(input, rules, preserveOther);
    } else {
      // If Input is not an object/array, just return it unchanged
      output = input;
    }

    return {
      id: this.id,
      output,
      startedAt,
      finishedAt: Date.now(),
    };
  }

  /** Gather renaming rules from Input_1, Input_2, ... */
  private collectRules(ctx: ExecuteContext): RenameRule[] {
    const pairs: RenameRule[] = [];

    if (!ctx?.input) return pairs;

    for (const [key, value] of Object.entries(ctx.input)) {
      if (!key.startsWith("Input_")) continue;
      if (!Array.isArray(value) || value.length !== 2) continue;

      const from = String(value[0] ?? "").trim();
      const to = String(value[1] ?? "").trim();

      // require non-empty from & to
      if (!from || !to) continue;

      pairs.push({ from, to });
    }

    // If multiple rules target the same `to`, keep the last one (later Input_N wins)
    // Also remove exact duplicates
    const deduped: RenameRule[] = [];
    const seenTo = new Map<string, number>();
    pairs.forEach((r) => {
      if (seenTo.has(r.to)) {
        // overwrite previous index
        deduped[seenTo.get(r.to)!] = r;
      } else {
        seenTo.set(r.to, deduped.length);
        deduped.push(r);
      }
    });

    return deduped;
  }

  /** Rename keys on a single object, non-mutating. Top-level only. */
  private renameObject(
    obj: Record<string, unknown>,
    rules: RenameRule[],
    preserveOther: boolean
  ): Record<string, unknown> {
    if (rules.length === 0) {
      // No rules: return either original (preserve) or empty object (strip)
      return preserveOther ? { ...obj } : {};
    }

    if (preserveOther) {
      // Start with a shallow copy, then apply renames (moving values)
      const out: Record<string, unknown> = { ...obj };

      for (const { from, to } of rules) {
        if (Object.prototype.hasOwnProperty.call(obj, from)) {
          out[to] = obj[from];
          if (to !== from) {
            delete out[from]; // remove original when renaming
          }
        }
      }

      return out;
    } else {
      // Keep only renamed pairs that exist on the source
      const out: Record<string, unknown> = {};

      for (const { from, to } of rules) {
        if (Object.prototype.hasOwnProperty.call(obj, from)) {
          out[to] = obj[from];
        }
      }

      return out;
    }
  }

  private isPlainObject(val: unknown): val is Record<string, unknown> {
    return typeof val === "object" && val !== null && !Array.isArray(val);
  }
}
