import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class IteratorDomino implements DominoExecutable {
  id: string;
  type = "iterator" as const;

  constructor(private node: PipelineStep) {
    this.id = node.id;
  }

  /* ───────── helpers ───────── */

  private literal<T = any>(key: string): T | undefined {
    return (this.node.data as any)?.[key]?.value as T | undefined;
  }

  /* ───────── execute ───────── */

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    /* ---------- read config ---------- */
    const rawInput = ctx.input.Input;                     // value-pin override (may be undefined)
    const limitRaw  = this.literal<string>("Limit");      // “Count” field (string → number)
    const count     = limitRaw ? Number(limitRaw) : undefined;
    const isMax     = this.literal<boolean>("Max") ?? false; // “Max” toggle (defaults false)

    let items: any[];

    /* ---------- priority 1: connected value ---------- */
    if (rawInput !== undefined) {
      if (!Array.isArray(rawInput)) {
        throw new Error(
          `IteratorDomino "${this.id}" expects the connected Input pin to provide an array`,
        );
      }

      if (isMax) {
        // iterate the entire connected array
        items = rawInput;
      } else if (count !== undefined && !isNaN(count) && count > 0) {
        // iterate only the first <count> elements
        items = rawInput.slice(0, Math.min(count, rawInput.length));
      } else {
        // no valid Count ⇒ fall back to full array
        items = rawInput;
      }
    }

    /* ---------- priority 2: no connected value ---------- */
    else {
      if (count !== undefined && !isNaN(count) && count > 0) {
        // no Input array, but a positive Count was supplied ⇒ 0 … count-1
        items = Array.from({ length: count }, (_, i) => i);
      } else {
        throw new Error(
          `IteratorDomino "${this.id}" requires either:
  • a connected Input array, or
  • a positive Limit (Count) value`,
        );
      }
    }

    /* ---------- order ---------- */
    const order: "forward" | "reverse" =
      this.literal<"forward" | "reverse">("Order") ?? "forward";
    if (order === "reverse") items = [...items].reverse();

    /* ---------- cursor & emit ---------- */
    const cursorKey = `iterator_cursor_${this.id}`;
    const cursor = (ctx.local[cursorKey] as number | undefined) ?? 0;

    if (cursor < items.length) {
      const value = items[cursor];
      ctx.setLocal(cursorKey, cursor + 1);

      return {
        id: this.id,
        output: value,
        startedAt,
        finishedAt: Date.now(),
        nextChainKeys: ["exec_out"],          // “For each” branch
      };
    }

    /* ---------- complete ---------- */
    ctx.setLocal(cursorKey, undefined);

    return {
      id: this.id,
      output: "Iterations complete",
      startedAt,
      finishedAt: Date.now(),
      nextChainKeys: ["exec_out_1"],         // “On complete” branch
    };
  }
}
