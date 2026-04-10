type CalendarDateTimeValue = string | undefined;

const ISO_OFFSET_OR_Z_RE = /(Z|[+-]\d{2}:\d{2})$/i;
const TIME_WITH_OPTIONAL_OFFSET_RE = /T(\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)$/i;

function hasExplicitOffset(value: string): boolean {
  return ISO_OFFSET_OR_Z_RE.test(value.trim());
}

function normalizeDateInput(value: string | undefined): string | undefined {
  const normalized = String(value ?? "").trim();
  if (!normalized) return undefined;

  const isoMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (isoMatch?.[1]) return isoMatch[1];

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function mergeCalendarDateIntoDateTime(
  dateValue: string | undefined,
  dateTimeValue: CalendarDateTimeValue,
): CalendarDateTimeValue {
  const normalizedDate = normalizeDateInput(dateValue);
  const normalizedDateTime = String(dateTimeValue ?? "").trim();

  if (!normalizedDate || !normalizedDateTime) {
    return dateTimeValue;
  }

  const timeMatch = normalizedDateTime.match(TIME_WITH_OPTIONAL_OFFSET_RE);
  if (!timeMatch?.[1]) {
    return dateTimeValue;
  }

  return `${normalizedDate}T${timeMatch[1]}`;
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
