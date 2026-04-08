import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import { CalendarService } from "../../calendar/calendar.service";
import { buildCalendarDateTime } from "./googleCalendar.shared";

export class GoogleCalendarUpdateDomino implements DominoExecutable {
  id: string;
  type = "googleCalendarUpdate" as const;

  private readonly literalVaultId: string;
  private readonly literalCalendarId: string;
  private readonly literalEventId: string;
  private readonly literalSummary: string;
  private readonly literalDescription: string;
  private readonly literalLocation: string;
  private readonly literalStart: string;
  private readonly literalEnd: string;
  private readonly literalAttendees: any;
  private readonly literalTimezone: string;
  private readonly literalSendUpdates: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalVaultId = node.data?.vaultId?.value ?? "";
    this.literalCalendarId = node.data?.calendarId?.value ?? "primary";
    this.literalEventId = node.data?.eventId?.value ?? "";
    this.literalSummary = node.data?.summary?.value ?? "";
    this.literalDescription = node.data?.description?.value ?? "";
    this.literalLocation = node.data?.location?.value ?? "";
    this.literalStart = node.data?.start?.value ?? "";
    this.literalEnd = node.data?.end?.value ?? "";
    this.literalAttendees = node.data?.attendees?.value ?? [];
    this.literalTimezone = node.data?.timezone?.value ?? "";
    this.literalSendUpdates = node.data?.sendUpdates?.value ?? "all";
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
      throw new Error("Google Calendar Update: connect Google Calendar and select an account before running this domino.");
    }
    if (!calendarId) throw new Error("Google Calendar Update: calendarId is required");
    if (!eventId) throw new Error("Google Calendar Update: eventId is required");

    const attendees = input.attendees ?? this.literalAttendees;
    const timezone = input.timezone ?? this.literalTimezone;
    const sendUpdates = String(input.sendUpdates ?? this.literalSendUpdates ?? "all");

    const payload = {
      summary: (input.summary ?? this.literalSummary) || undefined,
      description: (input.description ?? this.literalDescription) || undefined,
      location: (input.location ?? this.literalLocation) || undefined,
      start: buildCalendarDateTime(input.start ?? this.literalStart, timezone, "start", false),
      end: buildCalendarDateTime(input.end ?? this.literalEnd, timezone, "end", false),
      sendUpdates,
      attendees: Array.isArray(attendees)
        ? attendees.map((email: string) => ({ email }))
        : typeof attendees === "string" && attendees.trim()
          ? attendees
              .split(",")
              .map((email: string) => email.trim())
              .filter(Boolean)
              .map((email: string) => ({ email }))
          : undefined,
    };

    const event = await CalendarService.instance.updateEvent(vaultId, calendarId, eventId, payload);

    return {
      id: this.id,
      output: event,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
