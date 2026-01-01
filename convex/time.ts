const DEFAULT_TIMEZONE = "Europe/Ljubljana";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(date);
  const tzName = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number.parseInt(match[2], 10);
  const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
  return sign * (hours * 60 + minutes) * 60 * 1000;
}

function getZonedParts(timestamp: number, timeZone = DEFAULT_TIMEZONE): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(timestamp));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number.parseInt(map.year, 10),
    month: Number.parseInt(map.month, 10),
    day: Number.parseInt(map.day, 10),
    hour: Number.parseInt(map.hour, 10),
    minute: Number.parseInt(map.minute, 10),
    second: Number.parseInt(map.second, 10),
  };
}

function getZonedTimestamp(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  timeZone = DEFAULT_TIMEZONE
): number {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMs = getTimeZoneOffsetMs(utcDate, timeZone);
  return utcDate.getTime() - offsetMs;
}

export function getDateKey(timestamp: number, timeZone = DEFAULT_TIMEZONE): string {
  const parts = getZonedParts(timestamp, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function getNextMidnightTimestamp(
  timestamp: number,
  timeZone = DEFAULT_TIMEZONE
): number {
  const parts = getZonedParts(timestamp, timeZone);
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  utcDate.setUTCDate(utcDate.getUTCDate() + 1);
  return getZonedTimestamp(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth() + 1,
    utcDate.getUTCDate(),
    0,
    0,
    0,
    timeZone
  );
}

export function getEndOfDayTimestamp(
  timestamp: number,
  timeZone = DEFAULT_TIMEZONE,
  hour = 23,
  minute = 0
): number {
  const parts = getZonedParts(timestamp, timeZone);
  return getZonedTimestamp(parts.year, parts.month, parts.day, hour, minute, 0, timeZone);
}

export function getSeasonWindow(year: number, timeZone = DEFAULT_TIMEZONE): {
  startAt: number;
  endAt: number;
} {
  const startAt = getZonedTimestamp(year, 1, 1, 0, 0, 0, timeZone);
  const endAt = getZonedTimestamp(year, 12, 24, 17, 0, 0, timeZone);
  return { startAt, endAt };
}

export function getSeasonYear(timestamp: number, timeZone = DEFAULT_TIMEZONE): number {
  const parts = getZonedParts(timestamp, timeZone);
  const { startAt } = getSeasonWindow(parts.year, timeZone);
  return timestamp < startAt ? parts.year - 1 : parts.year;
}

export function isWithinSeason(timestamp: number, timeZone = DEFAULT_TIMEZONE): boolean {
  const year = getSeasonYear(timestamp, timeZone);
  const { startAt, endAt } = getSeasonWindow(year, timeZone);
  return timestamp >= startAt && timestamp <= endAt;
}

export function getDefaultTimezone(): string {
  return DEFAULT_TIMEZONE;
}
