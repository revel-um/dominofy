import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class FilterDomino implements DominoExecutable {
  id: string;
  type = "filter" as const;

  private filterType: string;
  private property: string;
  private operator: string;
  private filterValue: any;

  constructor(private node: PipelineStep) {
    this.id = node.id;
    this.filterType = node.data?.Type?.value ?? "object";
    this.property = node.data?.Property?.value ?? "";
    this.operator = node.data?.Operator?.value ?? "equal";
    this.filterValue = node.data?.["Filter Value"]?.value ?? "";
  }

  private compare(a: any, b: any, op: string): boolean {
    a = a?.toString();
    b = b?.toString();
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
        return a?.includes(b);
      case "not_contains":
        return !a?.includes(b);
      default:
        throw new Error(`Unsupported operator '${op}' in FilterDomino`);
    }
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    // Accept input array from pin or fallback to node config
    const input = ctx.input.Input;
    // Accept type/property/operator/filterValue from input pins if provided
    const filterType = ctx.input.Type ?? this.filterType;
    const property = ctx.input.Property ?? this.property;
    const operator = ctx.input.Operator ?? this.operator;
    const filterValue = ctx.input["Filter Value"] ?? this.filterValue;

    let output: any = undefined;
    let nextChainKeys: string[] | undefined = undefined;

    console.log({filterType, input})
    if (Array.isArray(input)) {
      // Array filtering (existing behavior)
      if (filterType === "primitive") {
        output = input.filter(item => this.compare(item, filterValue, operator));
      } else {
        output = input.filter(item => this.compare(item?.[property], filterValue, operator));
      }
    } else if (filterType === "primitive") {
      // Single primitive value
      const result = this.compare(input, filterValue, operator);
      if (result) {
        output = input;
        nextChainKeys = ctx.input.nextChainKeys || undefined; // allow normal chaining
      } else {
        output = undefined;
        nextChainKeys = []; // do not run next domino
      }
    } else if (filterType === "object" && typeof input === 'object') {
      // Single object value
      const propValue = input[property];
      const result = this.compare(propValue, filterValue, operator);
      if (result) {
        output = input;
        nextChainKeys = ctx.input.nextChainKeys || undefined;
      } else {
        output = undefined;
        nextChainKeys = [];
      }
    } else {
      throw new Error("FilterDomino expects an array, primitive, or object value as input for the selected type");
    }

    return {
      id: this.id,
      output,
      startedAt,
      finishedAt: Date.now(),
      ...(nextChainKeys !== undefined ? { nextChainKeys } : {}),
    };
  }
} 