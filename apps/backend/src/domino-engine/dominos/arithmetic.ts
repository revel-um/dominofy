// domino-engine/dominos/arithmetic.domino.ts
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

/**
 * ArithmeticDomino takes a sequence of numeric inputs and operators
 * (+, -, *, /, %, ^) and computes the final result. Inputs and
 * operators may be overridden at runtime via ExecuteContext.
 */
export class ArithmeticDomino implements DominoExecutable {
    id: string;
    type = "arithmetic" as const;

    private inputKeys: string[];
    private operatorKeys: string[];
    private literalInputs: number[];
    private literalOperators: string[];

    constructor(node: PipelineStep) {
        this.id = node.id;
        const data = node.data || {};

        // Collect and sort input keys (Input_1, Input_2, ...)
        this.inputKeys = Object.keys(data)
            .filter((key) => key.startsWith("Input_"))
            .sort((a, b) => {
                const idxA = parseInt(a.split("_")[1], 10);
                const idxB = parseInt(b.split("_")[1], 10);
                return idxA - idxB;
            });

        // Collect and sort operator keys (Operator_1, Operator_2, ...)
        this.operatorKeys = Object.keys(data)
            .filter((key) => key.startsWith("Operator_"))
            .sort((a, b) => {
                const idxA = parseInt(a.split("_")[1], 10);
                const idxB = parseInt(b.split("_")[1], 10);
                return idxA - idxB;
            });

        // Parse literal default values from node.data
        this.literalInputs = this.inputKeys.map((key) =>
            parseFloat((data[key]?.value ?? 0).toString())
        );
        this.literalOperators = this.operatorKeys.map((key) =>
            (data[key]?.value ?? "+") as string
        );
    }

    async execute(ctx: ExecuteContext): Promise<DominoResult> {
        const startedAt = Date.now();
        // Build inputs array, overriding literals with dynamic inputs if provided
        const inputs = this.inputKeys.map((key, i) => {
            const override = ctx.input[key] as string | undefined;
            return parseFloat(override ?? this.literalInputs[i].toString());
        });

        // Build operators array, similarly overriding defaults
        const operators = this.operatorKeys.map((key, i) => {
            const override = ctx.input[key] as string | undefined;
            return override ?? this.literalOperators[i];
        });

        // Compute the result sequentially
        let result = inputs[0] ?? 0;
        for (let i = 1; i < inputs.length; i++) {
            const op = operators[i - 1];
            const val = inputs[i];
            switch (op) {
                case "+":
                    result += val;
                    break;
                case "-":
                    result -= val;
                    break;
                case "*":
                    result *= val;
                    break;
                case "/":
                    result /= val;
                    break;
                case "%":
                    result %= val;
                    break;
                case "^":
                    result = Math.pow(result, val);
                    break;
                default:
                    throw new Error(`ArithmeticDomino: Unsupported operator "${op}"`);
            }
        }

        // Return the computed result
        return {
            id: this.id,
            output: result,
            startedAt,
            finishedAt: Date.now()
        };
    }
}
