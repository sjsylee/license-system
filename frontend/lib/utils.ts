const KST_TIME_ZONE = "Asia/Seoul";
const KST_OFFSET_MINUTES = 9 * 60;
const SOURCE_OFFSET_MINUTES = 0;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_WITH_TZ = /(Z|[+-]\d{2}:\d{2})$/;
const SIMPLE_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?$/;

function readKstDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "0");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "0");

  return { year, month, day };
}

function toKstStartOfDayEpoch(date: Date): number {
  const { year, month, day } = readKstDateParts(date);
  return Date.UTC(year, month - 1, day) - KST_OFFSET_MINUTES * 60 * 1000;
}

export function parseBackendDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const input = dateStr.trim();
  if (!input) return null;

  if (ISO_WITH_TZ.test(input)) {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const simple = input.match(SIMPLE_DATETIME);
  if (simple) {
    const [, y, m, d, hh = "00", mm = "00", ss = "00", ms = "0"] = simple;
    const milliseconds = Number(ms.slice(0, 3).padEnd(3, "0"));
    const utcEpoch =
      Date.UTC(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(hh),
        Number(mm),
        Number(ss),
        milliseconds,
      ) -
      SOURCE_OFFSET_MINUTES * 60 * 1000;

    return new Date(utcEpoch);
  }

  const fallback = new Date(input);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatKST(dateStr: string, showTime = false): string {
  const date = parseBackendDate(dateStr);
  if (!date) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(showTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(date);
}

export function isToday(dateStr: string): boolean {
  const target = parseBackendDate(dateStr);
  if (!target) return false;

  return toKstStartOfDayEpoch(new Date()) === toKstStartOfDayEpoch(target);
}

export function daysUntil(dateStr: string): number {
  const target = parseBackendDate(dateStr);
  if (!target) return 0;

  const nowDayStart = toKstStartOfDayEpoch(new Date());
  const targetDayStart = toKstStartOfDayEpoch(target);
  return Math.floor((targetDayStart - nowDayStart) / MS_PER_DAY);
}
