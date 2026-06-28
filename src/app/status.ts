import type { LogEntry, Tank } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function lastLogOfType(
  tank: Tank,
  type: LogEntry["type"]
): LogEntry | undefined {
  // logs are kept newest-first
  return tank.logs.find((l) => l.type === type);
}

/** Whole days elapsed since an ISO date, or null if never. */
export function daysSince(iso: string | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const diff = now - new Date(iso).getTime();
  // Clamp tiny negatives from clock/state skew (e.g. an event logged a
  // moment after the ticking "now" snapshot) so a fresh log reads as today.
  return Math.max(0, Math.floor(diff / DAY_MS));
}

export interface TankStatus {
  daysSinceChange: number | null;
  daysSinceFeed: number | null;
  /** 0 = just changed, 1 = exactly due, >1 = overdue. */
  ratio: number;
  level: StatusLevel;
  label: string;
}

export type StatusLevel = "fresh" | "ok" | "due" | "overdue" | "never";

export const STATUS_COLORS: Record<StatusLevel, string> = {
  fresh: "#4e9a6b", // sage green
  ok: "#87a84b", // olive
  due: "#e0a53b", // ochre / amber
  overdue: "#d2774a", // warm orange
  never: "#c0503e", // brick red
};

export const STATUS_LABELS: Record<StatusLevel, string> = {
  fresh: "Fresh",
  ok: "Good",
  due: "Due soon",
  overdue: "Overdue",
  never: "Needs change",
};

export function getStatus(tank: Tank, now = Date.now()): TankStatus {
  const lastChange = lastLogOfType(tank, "water_change");
  const lastFeed = lastLogOfType(tank, "feeding");
  const daysSinceChange = daysSince(lastChange?.date, now);
  const daysSinceFeed = daysSince(lastFeed?.date, now);

  const interval = Math.max(1, tank.waterChangeIntervalDays);
  let level: StatusLevel;
  let ratio: number;

  if (daysSinceChange == null) {
    level = "never";
    ratio = 2;
  } else {
    ratio = daysSinceChange / interval;
    if (ratio < 0.6) level = "fresh";
    else if (ratio < 0.9) level = "ok";
    else if (ratio < 1.0) level = "due";
    else if (ratio < 1.5) level = "overdue";
    else level = "never";
  }

  let label: string;
  if (daysSinceChange == null) label = "No water change logged";
  else if (daysSinceChange === 0) label = "Changed today";
  else if (daysSinceChange === 1) label = "1 day ago";
  else label = `${daysSinceChange} days ago`;

  return { daysSinceChange, daysSinceFeed, ratio, level, label };
}

/** Color interpolated smoothly across the status gradient for map nodes. */
export function statusColor(ratio: number): string {
  // Stops: 0 -> green, 0.9 -> amber, 1 -> orange, 1.5+ -> red
  const stops: Array<[number, [number, number, number]]> = [
    [0, [78, 154, 107]],
    [0.6, [135, 168, 75]],
    [0.9, [224, 165, 59]],
    [1.0, [210, 119, 74]],
    [1.5, [192, 80, 62]],
  ];
  const t = Math.max(0, Math.min(1.5, ratio));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0 || 1);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * f));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  const last = stops[stops.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

/** Radius in px for a tank node, scaled by volume (area-proportional). */
export function nodeRadius(volumeGallons: number): number {
  const min = 26;
  const max = 64;
  // sqrt so visual area tracks volume; clamp to sane bounds
  const r = 13 * Math.sqrt(Math.max(1, volumeGallons)) ** 0.62 + 8;
  return Math.max(min, Math.min(max, r));
}

/** Sort tanks by urgency (most overdue first). */
export function byUrgency(a: Tank, b: Tank, now = Date.now()): number {
  return getStatus(b, now).ratio - getStatus(a, now).ratio;
}

/** Tanks on a given stack, ordered top shelf → bottom. */
export function stackMembers(tanks: Tank[], stackId: string): Tank[] {
  return tanks
    .filter((t) => t.stackId === stackId)
    .sort((a, b) => a.shelf - b.shelf);
}

export interface StackSummary {
  /** Worst (highest) urgency ratio among member tanks. */
  ratio: number;
  /** Largest member volume — drives the rack width on the map. */
  maxVolume: number;
  count: number;
  /** How many members are overdue / need a change. */
  attention: number;
}

export function summarizeStack(members: Tank[], now = Date.now()): StackSummary {
  let ratio = 0;
  let maxVolume = 0;
  let attention = 0;
  for (const t of members) {
    const st = getStatus(t, now);
    ratio = Math.max(ratio, st.ratio);
    maxVolume = Math.max(maxVolume, t.volumeGallons);
    if (st.level === "overdue" || st.level === "never") attention++;
  }
  return { ratio, maxVolume, count: members.length, attention };
}
