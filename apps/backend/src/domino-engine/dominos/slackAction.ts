import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import { SlackService } from "../../slack/slack.service";

/**
 * SlackActionDomino
 * Inputs expected on ctx.input (or literals from node.data):
 * - vaultId: string (Slack connection vault)
 * - channelId: string (channel where to post)
 * - text: string (message)
 * - thread_ts?: string
 */
export class SlackActionDomino implements DominoExecutable {
  id: string;
  type = "slackaction" as const;

  private literalVaultId: string;
  private literalChannelId: string;
  private literalText: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalVaultId = node.data?.vaultId?.value ?? "";
    this.literalChannelId = node.data?.channelId?.value ?? "";
    this.literalText = node.data?.text?.value ?? "";
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    const rawVaultId = (ctx.input as any)?.vaultId ?? this.literalVaultId;
    const rawChannelId = (ctx.input as any)?.channelId ?? this.literalChannelId;
    const rawText = (ctx.input as any)?.text ?? this.literalText;
    const thread_ts: string | undefined = (ctx.input as any)?.thread_ts as string | undefined;

    const vaultId: string = typeof rawVaultId === "string" ? rawVaultId : String(rawVaultId ?? "");
    const channelId: string = typeof rawChannelId === "string" ? rawChannelId : String(rawChannelId ?? "");
    const text: string = typeof rawText === "string" ? rawText : (rawText == null ? "" : JSON.stringify(rawText));

    if (!vaultId) throw new Error("SlackAction: vaultId is required");
    if (!channelId) throw new Error("SlackAction: channelId is required");
    if (!text) throw new Error("SlackAction: text is required");

    const result = await SlackService.instance.sendMessage(vaultId, channelId, text, { thread_ts });

    return {
      id: this.id,
      output: { ok: true, channel: result.channel, ts: result.ts },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}


