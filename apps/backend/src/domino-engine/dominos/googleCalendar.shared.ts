type CalendarDateTimeValue = string | undefined;

const ISO_OFFSET_OR_Z_RE = /(Z|[+-]\d{2}:\d{2})$/i;

function hasExplicitOffset(value: string): boolean {
  return ISO_OFFSET_OR_Z_RE.test(value.trim());
}

export function buildCalendarDateTime(
  value: CalendarDateTimeValue,
  timezone: string | undefined,
  fieldLabel: string,
  required: boolean,
): { dateTime: string; timeZone?: string } | undefined {
  const normalizedValue = String(value ?? "").trim();
  const normalizedTimezone = String(timezone ?? "").trim();

  if (!normalizedValue) {
    if (required) {
      throw new Error(`Google Calendar: ${fieldLabel} is required`);
    }
    return undefined;
  }

  if (!hasExplicitOffset(normalizedValue) && !normalizedTimezone) {
    throw new Error(
      `Google Calendar: ${fieldLabel} must include a timezone offset like +05:30 or provide the Timezone field.`,
    );
  }

  return {
    dateTime: normalizedValue,
    timeZone: normalizedTimezone || undefined,
  };
}
