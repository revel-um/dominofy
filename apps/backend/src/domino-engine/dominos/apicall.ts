// domino-engine/dominos/apicall.domino.ts
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import axios from "axios";

export class ApiCallDomino implements DominoExecutable {
  id: string;
  type = "apicall" as const;

  private url: string;
  private method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.url = node.data?.Url?.value ?? "";
    this.method = (node.data?.Method?.value ?? "GET") as any;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const res = await axios.request({
      url: this.url,
      method: this.method,
      data: ctx.input,
    });
    console.log(res.data)
    return {
      id: this.id,
      output: res.data,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
