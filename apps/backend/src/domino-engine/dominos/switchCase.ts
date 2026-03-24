// domino-engine/dominos/switchcase.domino.ts

import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class SwitchCaseDomino implements DominoExecutable {
    id: string;
    type = "switchcase" as const;

    constructor(private node: PipelineStep) {
        this.id = node.id;
    }

    async execute(ctx: ExecuteContext): Promise<DominoResult> {
        const startedAt = Date.now();

        // 1️⃣ Resolve the main Input: prefer connected override, else literal default
        const rawInput = ctx.input.Input;
        const defaultInput = this.node.data.Input?.value;
        const inputValue = rawInput !== undefined
            ? String(rawInput)
            : String(defaultInput ?? "");

        // 2️⃣ Collect and sort all Case_<n> keys (Case_1, Case_2, …)
        const caseKeys = Object.keys(this.node.data)
            .filter(key => /^Case_\d+$/.test(key))
            .sort((a, b) => {
                const na = Number(a.split("_")[1]);
                const nb = Number(b.split("_")[1]);
                return na - nb;
            });

        // 3️⃣ Find *all* matching cases (dynamic override first, then literal)
        const matchedIndices: number[] = caseKeys.reduce<number[]>((acc, caseKey, idx) => {
            const rawOverride = ctx.input[caseKey];
            const literalCase = this.node.data[caseKey]?.value;
            const caseValue = rawOverride !== undefined
                ? String(rawOverride)
                : String(literalCase ?? "");
            if (caseValue === inputValue) {
                acc.push(idx);
            }
            return acc;
        }, []);

        // 4️⃣ Build nextChainKeys: one exec_out_<n> per match, or default if none
        const nextChainKeys = matchedIndices.length > 0
            ? matchedIndices.map(i => `exec_out_${i + 1}`)
            : ["exec_out"];

        return {
            id: this.id,
            output: inputValue,
            startedAt,
            finishedAt: Date.now(),
            nextChainKeys
        };
    }
}
