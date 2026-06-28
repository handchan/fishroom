// Core data model for the Fishroom aquarium tracker.

export type WaterType = "freshwater" | "planted" | "saltwater" | "brackish";

export interface LogEntry {
  id: string;
  /** ISO timestamp of when the event happened. */
  date: string;
  type: "water_change" | "feeding";
  /** For water changes: percent of volume changed. */
  percent?: number;
  note?: string;
}

export interface Tank {
  id: string;
  name: string;
  /** Volume in US gallons. Drives node size on the map. */
  volumeGallons: number;
  waterType: WaterType;

  /** Target interval between water changes, in days. */
  waterChangeIntervalDays: number;
  /** Typical percent changed, used to prefill the quick log. */
  defaultChangePercent: number;

  /** Position on the fishroom map, normalized 0..1 of the canvas. */
  x: number;
  y: number;

  /** Metadata */
  livestock: string;
  notes: string;
  tempF?: number;

  createdAt: string;
  /** Most recent events, newest first. */
  logs: LogEntry[];
}

export interface AppState {
  version: number;
  tanks: Tank[];
}
