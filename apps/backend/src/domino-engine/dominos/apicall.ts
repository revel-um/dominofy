// domino-engine/dominos/apicall.domino.ts
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import axios from "axios";

export class ApiCallDomino implements DominoExecutable {
  id: string;
  type = "apicall" as const;

  private literalUrl: string;
  private literalMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

  constructor(node: PipelineStep) {
    this.id = node.id;
    // Store literal defaults
    this.literalUrl = node.data?.Url?.value ?? "";
    this.literalMethod = (node.data?.Method?.value ?? "GET") as any;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    // Resolve URL and method from input overrides first, else fallback to literals
    const url = (ctx.input.Url as string) ?? this.literalUrl;
    const method = (ctx.input.Method as string as any) ?? this.literalMethod;
    // Payload/body can be passed via a 'Body' field if connected
    const data = ctx.input.Body ?? {}; // default to empty object

    const res = await axios.request({ url, method, data });
    return {
      id: this.id,
      output: res.data,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
