import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import {
    DominoExecutable,
    ExecuteContext,
    DominoResult,
} from "../domino-engine.type";

/* ───────── helpers ───────── */

function getFieldValue<T = any>(
    node: PipelineStep,
    heading: string,
): T | undefined {
    return node.data[heading].value;
}

function initialAccumulator(op: string, initRaw: any) {
    switch (op) {
        case "array":
            return [];
        case "object":
            return {};
        default: {
            const n = Number(initRaw);
            return initRaw !== undefined && initRaw !== "" && !Number.isNaN(n) ? n : 0;
        }
    }
}

/* ───────── domino ───────── */

export class AggregatorDomino implements DominoExecutable {
    readonly id: string;
    readonly type = "aggregator";

    constructor(private node: PipelineStep) {
        this.id = node.id;
    }

    async execute(ctx: ExecuteContext): Promise<DominoResult> {
        const startedAt = Date.now();
        /* static config */
        const op = getFieldValue<string>(this.node, "Operation") ?? "sum";
        const initRaw = ctx.input['Initial Value'] ?? getFieldValue<any>(this.node, "Initial Value");

        /* state */
        let acc = ctx.local.acc;
        if (acc === undefined) acc = initialAccumulator(op, initRaw);

        /* inputs ----------------------------------------------------------- */
        // 1. explicit pin mapping value_in / value_in_1 (plus some legacy cases)
        // 2. 'value' (if you wired iterator.value_out → aggregator.value)
        // 3. raw payload itself (iterator sends primitive or {key,value})
        let valIn: any = ctx.input.value_in ?? ctx.input.value_in_1;
        if (valIn === undefined) valIn = ctx.input.value;
        if (valIn === undefined) valIn = ctx.input.Input;
        if (valIn === undefined) valIn = ctx.input; // raw pass-through

        if (
            valIn &&
            typeof valIn === "object" &&
            "Input" in valIn &&
            Object.keys(valIn).length === 1
        ) {
            valIn = (valIn as any).Input;
        }
        const keyIn = ctx.input.key_in ?? (valIn && valIn.key); // object key

        /* If iterator passes {key, value}, unwrap for object op ----------- */
        if (op === "object" && valIn && typeof valIn === "object") {
            if ("key" in valIn && "value" in valIn) {
                valIn = (valIn as any).value;
            }
        }

        /* accumulate ------------------------------------------------------- */
        switch (op) {
            case "sum":
                if (typeof valIn !== "number") {
                    throw new Error(
                        `AggregatorDomino (${this.id}): sum operation requires a number, got ${typeof valIn}`
                    );
                }
                acc += valIn;
                break;

            case "subtract":
                if (typeof valIn !== "number") {
                    throw new Error(
                        `AggregatorDomino (${this.id}): subtract operation requires a number, got ${typeof valIn}`
                    );
                }
                acc -= valIn;
                break;

            case "multiply":
                if (typeof valIn !== "number") {
                    throw new Error(
                        `AggregatorDomino (${this.id}): multiply operation requires a number, got ${typeof valIn}`
                    );
                }
                acc *= valIn;
                break;

            case "divide":
                if (typeof valIn !== "number") {
                    throw new Error(
                        `AggregatorDomino (${this.id}): divide operation requires a number, got ${typeof valIn}`
                    );
                }
                acc /= valIn;
                break;

            case "min":
                if (typeof valIn !== "number") {
                    throw new Error(
                        `AggregatorDomino (${this.id}): min operation requires a number, got ${typeof valIn}`
                    );
                }
                acc = acc === null || acc === undefined ? valIn : Math.min(acc, valIn);
                break;

            case "max":
                if (typeof valIn !== "number") {
                    throw new Error(
                        `AggregatorDomino (${this.id}): max operation requires a number, got ${typeof valIn}`
                    );
                }
                acc = acc === null || acc === undefined ? valIn : Math.max(acc, valIn);
                break;

            case "array":
                // allow any type to be collected
                (acc as any[]).push(valIn);
                break;

            case "object":
                if (valIn && typeof valIn === "object") {
                    if ("key" in valIn && "value" in valIn) {
                        valIn = (valIn as any).value;
                    }
                }
                if (keyIn === undefined) {
                    throw new Error(
                        `AggregatorDomino (${this.id}): object operation requires a key for mapping`
                    );
                }
                (acc as Record<string, any>)[keyIn] = valIn;
                break;

            default:
                throw new Error(`AggregatorDomino (${this.id}): unknown operation "${op}"`);
        }

        /* persist for next loop */
        ctx.setLocal("acc", acc);

        /* iterator "done" flag you added (top-level) ----------------------- */
        const isFinalCall = ctx.done;
        /* build result ----------------------------------------------------- */
        const finishedAt = Date.now();
        const result: DominoResult = {
            id: this.id,
            output: isFinalCall ? acc : {}, // emit result only once
            startedAt,
            finishedAt,
            nextChainKeys: isFinalCall ? ["exec_out"] : [],
            done: isFinalCall,
        };

        /* reset accumulator after finishing */
        if (isFinalCall) ctx.setLocal("acc", undefined);
        return result;
    }
}
