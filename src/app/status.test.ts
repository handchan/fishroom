import { describe, it, expect } from "vitest";
import {
  daysSince,
  getStatus,
  nodeRadius,
  statusColor,
  summarizeStack,
  stackMembers,
  DAY_MS,
} from "./status";
import type { LogEntry, Tank } from "./types";

const NOW = Date.UTC(2026, 5, 29, 12, 0, 0); // fixed clock for determinism

function tank(partial: Partial<Tank> = {}): Tank {
  return {
    id: "t1",
    name: "Test",
    volumeGallons: 20,
    waterType: "freshwater",
    waterChangeIntervalDays: 10,
    defaultChangePercent: 30,
    stackId: "s1",
    shelf: 0,
    stock: [],
    notes: "",
    createdAt: new Date(NOW - 100 * DAY_MS).toISOString(),
    logs: [],
    ...partial,
  };
}

function wc(daysAgo: number): LogEntry {
  return {
    id: "l" + daysAgo,
    date: new Date(NOW - daysAgo * DAY_MS).toISOString(),
    type: "water_change",
    percent: 30,
  };
}

describe("daysSince", () => {
  it("returns null when there is no date", () => {
    expect(daysSince(undefined, NOW)).toBeNull();
  });

  it("floors elapsed whole days", () => {
    expect(daysSince(new Date(NOW - 3.7 * DAY_MS).toISOString(), NOW)).toBe(3);
  });

  it("clamps small negative skew to 0", () => {
    expect(daysSince(new Date(NOW + 5000).toISOString(), NOW)).toBe(0);
  });
});

describe("getStatus levels", () => {
  it("is 'never' when no water change has been logged", () => {
    const st = getStatus(tank(), NOW);
    expect(st.level).toBe("never");
    expect(st.daysSinceChange).toBeNull();
    expect(st.ratio).toBe(2);
  });

  it("is 'fresh' just after a change", () => {
    expect(getStatus(tank({ logs: [wc(1)] }), NOW).level).toBe("fresh");
  });

  it("is 'ok' in the mid-range and 'due' as it reaches the interval", () => {
    // 8/10 = 0.8 → ok ; 9/10 = 0.9 → due (0.9 <= ratio < 1.0)
    expect(getStatus(tank({ logs: [wc(8)] }), NOW).level).toBe("ok");
    expect(getStatus(tank({ logs: [wc(9)] }), NOW).level).toBe("due");
  });

  it("is 'overdue' past the interval and 'never' far past it", () => {
    expect(getStatus(tank({ logs: [wc(12)] }), NOW).level).toBe("overdue");
    expect(getStatus(tank({ logs: [wc(20)] }), NOW).level).toBe("never");
  });

  it("guards against a zero/negative interval", () => {
    const st = getStatus(tank({ waterChangeIntervalDays: 0, logs: [wc(2)] }), NOW);
    expect(Number.isFinite(st.ratio)).toBe(true);
  });

  it("picks the most recent water change from unsorted logs", () => {
    const st = getStatus(tank({ logs: [wc(2), wc(40)] }), NOW);
    expect(st.daysSinceChange).toBe(2);
  });
});

describe("statusColor", () => {
  it("returns an rgb() string and clamps out-of-range ratios", () => {
    expect(statusColor(-5)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(statusColor(99)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
});

describe("nodeRadius", () => {
  it("stays within the documented bounds and grows with volume", () => {
    expect(nodeRadius(1)).toBeGreaterThanOrEqual(26);
    expect(nodeRadius(100000)).toBeLessThanOrEqual(64);
    expect(nodeRadius(75)).toBeGreaterThan(nodeRadius(5));
  });
});

describe("stack helpers", () => {
  const tanks: Tank[] = [
    tank({ id: "a", stackId: "s1", shelf: 1, volumeGallons: 10, logs: [wc(20)] }),
    tank({ id: "b", stackId: "s1", shelf: 0, volumeGallons: 40, logs: [wc(1)] }),
    tank({ id: "c", stackId: "s2", shelf: 0 }),
  ];

  it("orders members top shelf first", () => {
    expect(stackMembers(tanks, "s1").map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("summarizes worst urgency, max volume, and attention count", () => {
    const sum = summarizeStack(stackMembers(tanks, "s1"), NOW);
    expect(sum.count).toBe(2);
    expect(sum.maxVolume).toBe(40);
    expect(sum.attention).toBe(1); // tank "a" is well overdue
    expect(sum.ratio).toBeGreaterThan(1.5);
  });
});
