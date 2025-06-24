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

  /** Build the iteration list from an input that can be array OR object */
  private buildItems(
    src: any,
    count: number | undefined,
    isMax: boolean,
  ): any[] {
    if (Array.isArray(src)) {
      // ── array branch ──
      if (isMax || count === undefined || isNaN(count) || count <= 0) {
        return src;
      }
      return src.slice(0, Math.min(count, src.length));
    }

    if (src !== null && typeof src === "object") {
      // ── object branch ──
      const entries = Object.entries(src).map(([key, value]) => ({ key, value }));
      if (isMax || count === undefined || isNaN(count) || count <= 0) {
        return entries;
      }
      return entries.slice(0, Math.min(count, entries.length));
    }

    throw new Error(
      `IteratorDomino "${this.id}" expects Input to be an array or object (received ${typeof src})`,
    );
  }

  /* ───────── execute ───────── */

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    /* ---------- read config ---------- */
    const rawInput   = ctx.input.Input;
    const limitRaw   = this.literal<string>("Limit");
    const count      = limitRaw ? Number(limitRaw) : undefined;
    const isMax      = this.literal<boolean>("Max") ?? false;

    let items: any[];

    /* ---------- priority 1: connected value ---------- */
    if (rawInput !== undefined) {
      items = this.buildItems(rawInput, count, isMax);
    }
    /* ---------- priority 2: no connected value ---------- */
    else {
      if (count !== undefined && !isNaN(count) && count > 0) {
        // no Input, but positive Count ⇒ simple numeric range 0 … count-1
        items = Array.from({ length: count }, (_, i) => i);
      } else {
        throw new Error(
          `IteratorDomino "${this.id}" requires either:
  • a connected array/object Input, or
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
        output: value,              // value or {key, value}
        startedAt,
        finishedAt: Date.now(),
        nextChainKeys: ["exec_out"], // “For each” branch
      };
    }

    /* ---------- complete ---------- */
    ctx.setLocal(cursorKey, undefined);

    return {
      id: this.id,
      output: "Iterations complete",
      startedAt,
      finishedAt: Date.now(),
      nextChainKeys: ["exec_out_1"], // “On complete” branch
    };
  }
}
