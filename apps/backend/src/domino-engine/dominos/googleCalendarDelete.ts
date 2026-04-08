import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import { CalendarService } from "../../calendar/calendar.service";

export class GoogleCalendarDeleteDomino implements DominoExecutable {
  id: string;
  type = "googleCalendarDelete" as const;

  private readonly literalVaultId: string;
  private readonly literalCalendarId: string;
  private readonly literalEventId: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalVaultId = node.data?.vaultId?.value ?? "";
    this.literalCalendarId = node.data?.calendarId?.value ?? "primary";
    this.literalEventId = node.data?.eventId?.value ?? "";
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const input = (ctx.input ?? {}) as Record<string, any>;
    const vaultId = String(input.vaultId ?? this.literalVaultId ?? "");
    const calendarId = String(input.calendarId ?? this.literalCalendarId ?? "primary");
    const eventId = String(
      input.eventId ?? input.id ?? input.event?.id ?? this.literalEventId ?? "",
    );

    if (!vaultId) {
      throw new Error("Google Calendar Delete: connect Google Calendar and select an account before running this domino.");
    }
    if (!calendarId) throw new Error("Google Calendar Delete: calendarId is required");
    if (!eventId) throw new Error("Google Calendar Delete: eventId is required");

    const result = await CalendarService.instance.deleteEvent(vaultId, calendarId, eventId);
    return {
      id: this.id,
      output: result,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
