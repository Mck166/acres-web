import type { Property } from "@/lib/api";
import type { OpenHouseRecord } from "@/lib/social";

const BADGE_COLORS = {
  Now: "#2e9e4f",
  Today: "#1b6ca8",
  Tomorrow: "#8b5a2b",
} as const;

export type OpenHouseBadge = {
  text: "Now" | "Today" | "Tomorrow";
  backgroundColor: string;
};

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isUpcomingOpenHouse(item: Pick<OpenHouseRecord, "endsAt">, now = new Date()) {
  const end = parseDate(item?.endsAt);
  return Boolean(end && end.getTime() > now.getTime());
}

export function filterUpcomingOpenHouses(items: OpenHouseRecord[], now = new Date()) {
  return (items || [])
    .filter((item) => isUpcomingOpenHouse(item, now))
    .sort((a, b) => String(a.startsAt || "").localeCompare(String(b.startsAt || "")));
}

export function openHouseBadge(
  startsAt?: string,
  endsAt?: string,
  now = new Date(),
): OpenHouseBadge | null {
  const start = parseDate(startsAt);
  const end = parseDate(endsAt);
  if (!start || !end) return null;
  if (now >= start && now <= end) {
    return { text: "Now", backgroundColor: BADGE_COLORS.Now };
  }
  const startDay = startOfDay(start);
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (startDay.getTime() === today.getTime()) {
    return { text: "Today", backgroundColor: BADGE_COLORS.Today };
  }
  if (startDay.getTime() === tomorrow.getTime()) {
    return { text: "Tomorrow", backgroundColor: BADGE_COLORS.Tomorrow };
  }
  return null;
}

export function formatOpenHouseWhen(startsAt?: string, endsAt?: string) {
  const start = parseDate(startsAt);
  const end = parseDate(endsAt);
  if (!start || !end) return "";
  const sameDay = start.toDateString() === end.toDateString();
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `${dateLabel} · ${startTime}–${endTime}`;
  const endDate = end.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${dateLabel} ${startTime} – ${endDate} ${endTime}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultOpenHouseTimes() {
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMilliseconds(0);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setHours(16, 0, 0, 0);
  if (end.getTime() <= Date.now()) {
    start.setDate(start.getDate() + 1);
    end.setDate(end.getDate() + 1);
  }
  return { start: toLocalInput(start), end: toLocalInput(end) };
}

export function matchPropertyForOpenHouse(openHouse: OpenHouseRecord, properties: Property[]) {
  const propertyId = String(openHouse?.propertyId || "");
  const pid = String(openHouse?.pid || "");
  return (
    (properties || []).find((property) => {
      const id = String(property?._id || "");
      const listingPid = String(property?.PID || property?.pid || "");
      return (
        (propertyId && id === propertyId) ||
        (pid && listingPid === pid) ||
        (propertyId && listingPid === propertyId)
      );
    }) || null
  );
}
