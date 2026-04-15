import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import { CalendarService } from "../../calendar/calendar.service";
import { buildCalendarDateTime, mergeCalendarDateIntoDateTime } from "./googleCalendar.shared";
import { randomUUID } from "crypto";

export class GoogleCalendarCreateDomino implements DominoExecutable {
  id: string;
  type = "googleCalendarCreate" as const;

  private readonly literalVaultId: string;
  private readonly literalCalendarId: string;
  private readonly literalSummary: string;
  private readonly literalDescription: string;
  private readonly literalLocation: string;
  private readonly literalDate: string;
  private readonly literalStart: string;
  private readonly literalEnd: string;
  private readonly literalAttendees: any;
  private readonly literalTimezone: string;
  private readonly literalSendUpdates: string;
  private readonly literalCreateMeetLink: string;
  private readonly literalRecurrence: any;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalVaultId = node.data?.vaultId?.value ?? "";
    this.literalCalendarId = node.data?.calendarId?.value ?? "primary";
    this.literalSummary = node.data?.summary?.value ?? "";
    this.literalDescription = node.data?.description?.value ?? "";
    this.literalLocation = node.data?.location?.value ?? "";
    this.literalDate = node.data?.date?.value ?? "";
    this.literalStart = node.data?.start?.value ?? "";
    this.literalEnd = node.data?.end?.value ?? "";
    this.literalAttendees = node.data?.attendees?.value ?? [];
    this.literalTimezone = node.data?.timezone?.value ?? "";
    this.literalSendUpdates = node.data?.sendUpdates?.value ?? "all";
    this.literalCreateMeetLink = node.data?.createMeetLink?.value ?? "false";
    this.literalRecurrence = node.data?.recurrence?.value ?? "";
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const input = (ctx.input ?? {}) as Record<string, any>;

    const vaultId = String(input.vaultId ?? this.literalVaultId ?? "");
    const calendarId = String(input.calendarId ?? this.literalCalendarId ?? "primary");
    const summary = input.summary ?? this.literalSummary;
    const description = input.description ?? this.literalDescription;
    const location = input.location ?? this.literalLocation;
    const date = input.date ?? this.literalDate;
    const start = mergeCalendarDateIntoDateTime(date, input.start ?? this.literalStart);
    const end = mergeCalendarDateIntoDateTime(date, input.end ?? this.literalEnd);
    const attendees = input.attendees ?? this.literalAttendees;
    const timezone = input.timezone ?? this.literalTimezone;
    const sendUpdates = String(input.sendUpdates ?? this.literalSendUpdates ?? "all");
    const createMeetLink = String(input.createMeetLink ?? this.literalCreateMeetLink ?? "false") === "true";
    const recurrence = input.recurrence ?? this.literalRecurrence;

    if (!vaultId) {
      throw new Error("Google Calendar Create: connect Google Calendar and select an account before running this domino.");
    }
    if (!calendarId) throw new Error("Google Calendar Create: calendarId is required");
    if (!summary) throw new Error("Google Calendar Create: summary is required");
    if (!start) throw new Error("Google Calendar Create: start is required");
    if (!end) throw new Error("Google Calendar Create: end is required");

    const event = await CalendarService.instance.createEvent(vaultId, calendarId, {
      summary,
      description: description || undefined,
      location: location || undefined,
      start: buildCalendarDateTime(start, timezone, "start", true),
      end: buildCalendarDateTime(end, timezone, "end", true),
      sendUpdates,
      conferenceData: createMeetLink
        ? {
            createRequest: {
              requestId: `dominofy-${randomUUID()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          }
        : undefined,
      recurrence: Array.isArray(recurrence)
        ? recurrence.filter(Boolean)
        : typeof recurrence === "string" && recurrence.trim()
          ? recurrence
              .split(/\n|,/)
              .map((rule: string) => rule.trim())
              .filter(Boolean)
          : undefined,
      attendees: Array.isArray(attendees)
        ? attendees.map((email: string) => ({ email }))
        : typeof attendees === "string" && attendees.trim()
          ? attendees
              .split(",")
              .map((email: string) => email.trim())
              .filter(Boolean)
              .map((email: string) => ({ email }))
          : undefined,
    });

    return {
      id: this.id,
      output: event,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
