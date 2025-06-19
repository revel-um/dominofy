import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class ConditionDomino implements DominoExecutable {
    id: string;
    type = "condition" as const;

    constructor(private node: PipelineStep) {
        this.id = node.id;
    }

    // helper to compare values based on operator
    private compare(a: string, b: string, op: string): boolean {
        a = a.toString();
        b = b.toString();

        switch (op) {
            case "equal":
                return a == b;
            case "not_equal":
                return a != b;
            case "greater_than":
                return a > b;
            case "less_than":
                return a < b;
            case "greater_or_equal":
                return a >= b;
            case "less_or_equal":
                return a <= b;
            case "contains":
                return a.includes(b)
            default:
                throw new Error(`Unsupported operator '${op}' in ConditionDomino`);
        }
    }

    async execute(ctx: ExecuteContext): Promise<DominoResult> {
        const startedAt = Date.now();

        // Extract inputs (Text1, Text2, Option)
        const a = ctx.input.Text1;
        const b = ctx.input.Text2;
        const op = ctx.input.Option;

        const result = this.compare(a, b, op);

        // Determine which branches to follow
        // Assuming step.next contains keys like 'exec_out_1' and 'exec_out_2'
        const trueBranch = 'exec_out_1';
        const falseBranch = 'exec_out_2';
        const nextKeys: string[] = result
            ? [trueBranch]   // follow the first branch when condition is true
            : [falseBranch]; // follow the second branch when false

        return {
            id: this.id,
            output: result,
            startedAt,
            finishedAt: Date.now(),
            nextChainKeys: nextKeys
        };
    }
}
