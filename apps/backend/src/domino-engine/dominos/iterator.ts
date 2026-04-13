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
    start: number,
    end: number,
    isMax: boolean,
  ): any[] {
    if (typeof src === "number" && Number.isFinite(src)) {
      const upperBound = Math.max(0, Math.floor(src));
      const range = Array.from({ length: upperBound }, (_, index) => index);
      if (isMax) {
        return range;
      }
      const from = Math.max(0, start);
      const to = Math.min(end, range.length);
      return range.slice(from, to);
    }

    if (Array.isArray(src)) {
      if (isMax) {
        return src;
      }
      // slice from start to end (non-negative, bounded)
      const from = Math.max(0, start);
      const to = Math.min(end, src.length);
      return src.slice(from, to);
    }

    if (src !== null && typeof src === "object") {
      const entries = Object.entries(src).map(([key, value]) => ({ key, value }));
      if (isMax) {
        return entries;
      }
      const from = Math.max(0, start);
      const to = Math.min(end, entries.length);
      return entries.slice(from, to);
    }

    throw new Error(
      `IteratorDomino "${this.id}" expects Input to be an array, object, or number (received ${typeof src})`,
    );
  }

  /* ───────── execute ───────── */
  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    /* ---------- read config ---------- */
    const rawInput = ctx.input.Input;
    const start = Number(this.literal<string>("Range Start") ?? "0");
    const end = Number(this.literal<string>("Range End") ?? "0");
    const isMax = this.literal<boolean>("Max") ?? false;

    let items: any[];

    /* ---------- priority 1: connected value ---------- */
    if (rawInput !== undefined) {
      items = this.buildItems(rawInput, start, end, isMax);
    }
    /* ---------- priority 2: no connected value ---------- */
    else {
      if (!isNaN(start) && !isNaN(end) && end > start) {
        items = Array.from({ length: end - start }, (_, i) => start + i);
      } else {
        throw new Error(
          `IteratorDomino "${this.id}" requires either:\n  • a connected array/object Input, or\n  • Range Start < Range End values`,
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
        done: cursor + 1 === items.length,
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
      done: true,
      startedAt,
      finishedAt: Date.now(),
      nextChainKeys: ["exec_out_1"], // “On complete” branch
    };
  }
}
