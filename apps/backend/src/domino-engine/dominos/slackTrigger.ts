import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

export class SlackTriggerDomino implements DominoExecutable {
    id: string;
    type = "slacktrigger";
    isTrigger = true;

    constructor(node: PipelineStep) {
        this.id = node.id;
    }

    async execute(ctx: ExecuteContext): Promise<DominoResult> {
        const startedAt = Date.now();
        const source =
            ctx.input && typeof ctx.input === "object" && ctx.input.text && typeof ctx.input.text === "object"
                ? ctx.input.text
                : ctx.input;
        const rawEvent =
            source?.event && typeof source.event === "object"
                ? source.event
                : source;
        const cleaned: Record<string, any> = {};

        if (rawEvent && typeof rawEvent === "object") {
            const { text, user, channel, ts, thread_ts, files, blocks, attachments } =
                rawEvent as Record<string, any>;
            if (text !== undefined) cleaned.text = text;
            if (user !== undefined) cleaned.user = user;
            if (channel !== undefined) cleaned.channel = channel;
            if (ts !== undefined) cleaned.ts = ts;
            if (thread_ts !== undefined) cleaned.thread_ts = thread_ts;
            if (files !== undefined) cleaned.files = files;
            if (blocks !== undefined) cleaned.blocks = blocks;
            if (attachments !== undefined) cleaned.attachments = attachments;
            cleaned._rawEvent = rawEvent;
        }

        return {
            id: this.id,
            output: cleaned,
            startedAt,
            finishedAt: Date.now(),
        };
    }
}
