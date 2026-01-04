import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import {
  DominoExecutable,
  DominoResult,
  ExecuteContext,
} from "../domino-engine.type";
import { EmailService } from "../../email/email.service";

/**
 * EmailActionDomino
 * Inputs expected on ctx.input (or literals from node.data):
 * - vaultId: string (Email connection vault)
 * - to: string
 * - subject: string
 * - body: string
 * - html?: string
 * - cc?: string | string[]
 * - bcc?: string | string[]
 * - replyTo?: string
 */
export class EmailActionDomino implements DominoExecutable {
  id: string;
  type = "emailsender" as const;

  private literalVaultId: string;
  private literalTo: string;
  private literalSubject: string;
  private literalBody: any;
  private literalHtml: any;
  private literalFrom: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalVaultId = node.data?.vaultId?.value ?? "";
    this.literalTo = node.data?.to?.value ?? "";
    this.literalSubject = node.data?.subject?.value ?? "";
    this.literalBody = node.data?.body?.value ?? "";
    this.literalHtml = node.data?.html?.value ?? "";
    this.literalFrom = node.data?.from?.value ?? "";
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    const vaultIdRaw = (ctx.input as any)?.vaultId ?? this.literalVaultId;
    const toRaw = (ctx.input as any)?.to ?? this.literalTo;
    const subjectRaw = (ctx.input as any)?.subject ?? this.literalSubject;
    const bodyRaw = (ctx.input as any)?.body ?? this.literalBody;
    const htmlRaw = (ctx.input as any)?.html ?? this.literalHtml;
    const fromRaw = (ctx.input as any)?.from ?? this.literalFrom;
    const cc = (ctx.input as any)?.cc;
    const bcc = (ctx.input as any)?.bcc;
    const replyTo = (ctx.input as any)?.replyTo;

    const vaultId =
      typeof vaultIdRaw === "string" ? vaultIdRaw : String(vaultIdRaw ?? "");
    const to =
      typeof toRaw === "string" ? toRaw : JSON.stringify(toRaw ?? "");
    const subject =
      typeof subjectRaw === "string"
        ? subjectRaw
        : JSON.stringify(subjectRaw ?? "");
    const textBody =
      typeof bodyRaw === "string"
        ? bodyRaw
        : bodyRaw == null
          ? ""
          : JSON.stringify(bodyRaw);
    const html = typeof htmlRaw === "string" ? htmlRaw : undefined;
    const from = typeof fromRaw === "string" ? fromRaw : undefined;

    if (!vaultId) throw new Error("EmailAction: vaultId is required");
    if (!to) throw new Error("EmailAction: to is required");
    if (!subject) throw new Error("EmailAction: subject is required");

    const result = await EmailService.instance.sendEmail(
      vaultId,
      to,
      subject,
      {
        text: textBody,
        html,
        from,
        cc,
        bcc,
        replyTo,
      }
    );

    return {
      id: this.id,
      output: { ok: true, messageId: result.messageId },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
