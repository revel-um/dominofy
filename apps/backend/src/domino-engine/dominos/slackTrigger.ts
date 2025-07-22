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

        /** Step 1: strip config-only keys that upstream pins injected */
        const cleaned: Record<string, any> = ctx.input.text;

        /** Step 2: unwrap Slack’s event wrapper (if runner passed raw payload) */
        if (
            cleaned.event &&
            typeof cleaned.event === "object" &&
            cleaned.event.type === "message"
        ) {
            // Promote useful bits one level up
            const { text, user, ts, thread_ts, files, blocks, attachments } =
                cleaned.event;
            cleaned.text = text;
            cleaned.user = user;
            cleaned.ts = ts;
            if (thread_ts) cleaned.thread_ts = thread_ts;
            if (files) cleaned.files = files;
            if (blocks) cleaned.blocks = blocks;
            if (attachments) cleaned.attachments = attachments;

            // Keep the original for reference but mark as _raw to discourage pin-by-pin wiring
            cleaned._rawEvent = cleaned.event;
            delete cleaned.event;
        }

        return {
            id: this.id,
            output: cleaned,
            startedAt,
            finishedAt: Date.now(),
        };
    }
}
