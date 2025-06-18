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

    // 3️⃣ Find the first matching case by checking dynamic override first, then literal
    const matchIndex = caseKeys.findIndex(caseKey => {
      const rawOverride = ctx.input[caseKey];
      const literalCase = this.node.data[caseKey]?.value;
      const caseValue = rawOverride !== undefined
        ? String(rawOverride)
        : String(literalCase ?? "");
      return caseValue === inputValue;
    });

    // 4️⃣ Determine which branch to follow
    const nextKey = matchIndex >= 0
      ? `exec_out_${matchIndex + 1}`
      : "exec_out_default";

    return {
      id: this.id,
      output: inputValue,
      startedAt,
      finishedAt: Date.now(),
      nextChainKeys: [nextKey]
    };
  }
}
