import { describe, it, expect } from "vitest";
import { migrateV1, seed } from "./storage";

describe("migrateV1", () => {
  it("converts free-floating v1 tanks into one stack each, preserving position", () => {
    const v1 = JSON.stringify({
      tanks: [
        { id: "a", name: "Old A", x: 0.25, y: 0.4, logs: [] },
        { id: "b", name: "Old B", x: 0.7, y: 0.8, logs: [] },
      ],
    });
    const out = migrateV1(v1)!;
    expect(out).not.toBeNull();
    expect(out.version).toBe(2);
    expect(out.tanks).toHaveLength(2);
    expect(out.stacks).toHaveLength(2);
    // every tank is pinned to its own stack at shelf 0
    for (const t of out.tanks) {
      expect(t.shelf).toBe(0);
      expect(out.stacks.some((s) => s.id === t.stackId)).toBe(true);
    }
    const stackA = out.stacks.find((s) => s.id === out.tanks[0].stackId)!;
    expect(stackA.x).toBe(0.25);
    expect(stackA.y).toBe(0.4);
    // the legacy x/y are stripped off the tank itself
    expect("x" in out.tanks[0]).toBe(false);
    expect("y" in out.tanks[0]).toBe(false);
  });

  it("defaults missing coordinates to the canvas center", () => {
    const out = migrateV1(JSON.stringify({ tanks: [{ id: "a", logs: [] }] }))!;
    expect(out.stacks[0].x).toBe(0.5);
    expect(out.stacks[0].y).toBe(0.5);
  });

  it("returns null for malformed input", () => {
    expect(migrateV1("not json")).toBeNull();
    expect(migrateV1(JSON.stringify({ nope: true }))).toBeNull();
  });
});

describe("seed", () => {
  it("produces a self-consistent starter fishroom", () => {
    const s = seed();
    expect(s.version).toBe(2);
    expect(s.tanks.length).toBeGreaterThan(0);
    // every tank references a stack that exists
    const ids = new Set(s.stacks.map((st) => st.id));
    for (const t of s.tanks) expect(ids.has(t.stackId)).toBe(true);
    // the seeded room is a finished (closed) outline
    expect(s.room?.closed).toBe(true);
    expect((s.room?.points.length ?? 0)).toBeGreaterThanOrEqual(3);
  });
});
