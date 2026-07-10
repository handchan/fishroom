import { describe, it, expect } from "vitest";
import { toPublicData, PUBLIC_SCHEMA_VERSION } from "./contract";
import { DAY_MS } from "./status";
import type { AppState, LogEntry, Tank } from "./types";

const NOW = Date.UTC(2026, 5, 29, 12, 0, 0);

function tank(partial: Partial<Tank> = {}): Tank {
  return {
    id: "t",
    name: "Tank",
    volumeGallons: 20,
    waterType: "freshwater",
    waterChangeIntervalDays: 7,
    defaultChangePercent: 30,
    stackId: "s1",
    shelf: 0,
    stock: [],
    notes: "",
    createdAt: new Date(NOW - 50 * DAY_MS).toISOString(),
    logs: [],
    ...partial,
  };
}

function log(daysAgo: number, type: LogEntry["type"], extra: Partial<LogEntry> = {}): LogEntry {
  return {
    id: `${type}-${daysAgo}`,
    date: new Date(NOW - daysAgo * DAY_MS).toISOString(),
    type,
    ...extra,
  };
}

function state(tanks: Tank[]): AppState {
  return {
    version: 3,
    room: { points: [{ x: 0.1, y: 0.1 }] },
    stacks: [
      { id: "s1", x: 0.2, y: 0.3, label: "Shared rack" },
      { id: "s2", x: 0.6, y: 0.6, label: "Private rack" },
    ],
    tanks,
    species: [],
    reminders: { enabled: false, hour: 9 },
  };
}

describe("toPublicData", () => {
  it("includes only shared tanks and only their racks", () => {
    const s = state([
      tank({ id: "pub", stackId: "s1", shared: true }),
      tank({ id: "priv", stackId: "s2", shared: false }),
    ]);
    const out = toPublicData(s, NOW);
    expect(out.schemaVersion).toBe(PUBLIC_SCHEMA_VERSION);
    expect(out.tanks.map((t) => t.id)).toEqual(["pub"]);
    expect(out.racks.map((r) => r.id)).toEqual(["s1"]);
  });

  it("never leaks private fields beyond the contract", () => {
    const s = state([
      tank({ id: "pub", shared: true, notes: "SECRET dosing schedule" }),
    ]);
    const json = JSON.stringify(toPublicData(s, NOW));
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("notes");
  });

  it("derives history oldest→newest from newest-first logs", () => {
    const s = state([
      tank({
        id: "pub",
        shared: true,
        logs: [
          log(0, "feeding"),
          log(1, "water_change", { percent: 25 }),
          log(2, "temp_test", { tempF: 78 }),
          log(5, "water_change", { percent: 40 }),
        ],
      }),
    ]);
    const t = toPublicData(s, NOW).tanks[0];
    expect(t.waterChanges.map((w) => w.percent)).toEqual([40, 25]);
    expect(t.temperatures.map((r) => r.tempF)).toEqual([78]);
    expect(t.daysSinceWaterChange).toBe(1);
    expect(t.status).toBeDefined();
  });

  it("produces an empty payload when nothing is shared", () => {
    const out = toPublicData(state([tank({ shared: false })]), NOW);
    expect(out.tanks).toHaveLength(0);
    expect(out.racks).toHaveLength(0);
  });

  it("publishes structured stock plus a human-readable livestock summary", () => {
    const s = state([
      tank({
        id: "pub",
        shared: true,
        stock: [
          { id: "e1", species: "Cardinal tetra", kind: "livestock", count: 12 },
          { id: "e2", species: "Java fern", kind: "plant", count: 1 },
        ],
      }),
    ]);
    const t = toPublicData(s, NOW).tanks[0];
    expect(t.stock).toEqual([
      { name: "Cardinal tetra", kind: "livestock", count: 12 },
      { name: "Java fern", kind: "plant", count: 1 },
    ]);
    expect(t.livestock).toBe("12× Cardinal tetra, Java fern");
  });

  it("omits the livestock summary for an unstocked tank", () => {
    const t = toPublicData(state([tank({ shared: true })]), NOW).tanks[0];
    expect(t.livestock).toBeUndefined();
    expect(t.stock).toEqual([]);
  });

  it("only publishes the room once it's a closed polygon (3+ points)", () => {
    const s = state([tank({ shared: true })]);
    // An in-progress room with fewer than 3 points must not be published.
    s.room = { points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }] };
    expect(toPublicData(s, NOW).room).toBeUndefined();
    s.room = {
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.5, y: 0.8 },
      ],
    };
    expect(toPublicData(s, NOW).room?.points).toHaveLength(3);
  });
});
