// apps/backend/src/domino-engine/dominos/deconstructor.domino.ts
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import {
    DominoExecutable,
    ExecuteContext,
    DominoResult,
} from "../domino-engine.type";

type SelectorDescriptor = {
    selector: string;
    outPinId: string;
};

export class DeconstructorDomino implements DominoExecutable {
    id: string;
    type = "deconstructor" as const;

    constructor(private node: PipelineStep) {
        this.id = node.id;
    }

    /* ───────────────────────── helpers ───────────────────────── */

    /** Grab `.value` primitive, if any, on a key in node.data */
    private literal<T = any>(key: string): T | undefined {
        return (this.node.data as any)?.[key]?.value as T | undefined;
    }

    /** Collect Key_n / Field_n descriptors with runtime selectors */
    private collectSelectors(ctx: ExecuteContext): SelectorDescriptor[] {
        return Object.keys(this.node.data)
            .filter(k => /^(Key|Field)_\d+$/.test(k))
            .sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]))
            .map(k => {
                const fieldObj: any = (this.node.data as any)[k];
                const selector: string =
                    (ctx.input as any)[k] ?? fieldObj?.value ?? "";
                const outPinId: string =
                    fieldObj?.outPinId ??
                    (() => {
                        const idx = /_(\d+)$/.exec(k)?.[1];
                        return `value_out_${idx ?? selector}`;
                    })();
                return { selector: selector.toString().trim(), outPinId };
            })
            .filter(d => d.selector.length > 0);
    }

    /* ───────────────────────── execute ───────────────────────── */

    async execute(ctx: ExecuteContext): Promise<DominoResult> {
        const startedAt = Date.now();

        /* ---------- resolve Input ---------- */
        const input =
            ctx.input.Input !== undefined
                ? ctx.input.Input
                : this.literal("Input");

        if (input === undefined) {
            throw new Error("Deconstructor requires an Input value.");
        }

        /* ---------- resolve / validate Type ---------- */
        const typeLiteral =
            (ctx.input.Type ?? this.literal<string>("Type") ?? "array")
                .toString()
                .toLowerCase();

        const kind: "array" | "object" =
            typeLiteral === "object" ? "object" : "array";

        if (kind === "array" && !Array.isArray(input)) {
            throw new Error(
                `Type is “array” but provided input is ${typeof input}.`,
            );
        }
        if (
            kind === "object" &&
            (typeof input !== "object" || input === null || Array.isArray(input))
        ) {
            throw new Error(
                `Type is “object” but provided input is not a plain object.`,
            );
        }

        /* ---------- gather selectors ---------- */
        const selectors = this.collectSelectors(ctx);

        if (selectors.length === 0) {
            throw new Error(
                "No Key_n / Field_n selectors found; nothing to deconstruct.",
            );
        }

        /* ---------- build output ---------- */
        const output: Record<string, unknown> = {};

        if (kind === "array") {
            selectors.forEach(({ selector, outPinId }) => {
                const idx = Number(selector);
                if (!Number.isFinite(idx)) {
                    throw new Error(
                        `Selector “${selector}” is not a valid array index.`,
                    );
                }
                if (idx < 0 || idx >= (input as any[]).length) return; // silently skip OOB
                output[outPinId] = (input as any[])[idx];
            });
        } else {
            // object branch
            selectors.forEach(({ selector, outPinId }) => {
                if (selector in (input as object)) {
                    output[outPinId] = (input as any)[selector];
                }
            });
        }

        return {
            id: this.id,
            startedAt,
            finishedAt: Date.now(),
            output,
            isMultiOutPinDomino: true,
        };
    }
}
