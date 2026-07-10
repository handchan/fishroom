import { describe, it, expect } from "vitest";
import { mergeSpecies, migrateV1, normalizeState, seed, stockEntry } from "./storage";
import type { AppState } from "./types";

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
    expect(out.version).toBe(3);
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

describe("normalizeState (v2 → v3 stock migration)", () => {
  it("splits legacy free-text livestock into structured entries", () => {
    const v2 = {
      version: 2,
      stacks: [{ id: "s1", x: 0.5, y: 0.5 }],
      tanks: [
        {
          id: "a",
          name: "Old",
          stackId: "s1",
          shelf: 0,
          livestock: "Cardinal tetras, kuhli loaches; otos",
          logs: [],
        },
      ],
      reminders: { enabled: false, hour: 9 },
    } as unknown as AppState;

    const out = normalizeState(v2);
    expect(out.version).toBe(3);
    const stock = out.tanks[0].stock;
    expect(stock.map((e) => e.species)).toEqual([
      "Cardinal tetras",
      "kuhli loaches",
      "otos",
    ]);
    for (const e of stock) {
      expect(e.kind).toBe("livestock");
      expect(e.count).toBe(1);
    }
    // the legacy field is gone and the catalog knows every species
    expect("livestock" in out.tanks[0]).toBe(false);
    expect(out.species.map((s) => s.name)).toEqual(
      expect.arrayContaining(["Cardinal tetras", "kuhli loaches", "otos"])
    );
  });

  it("leaves already-structured stock untouched and fills the catalog", () => {
    const v3 = {
      version: 3,
      stacks: [{ id: "s1", x: 0.5, y: 0.5 }],
      tanks: [
        {
          id: "a",
          name: "New",
          stackId: "s1",
          shelf: 0,
          stock: [stockEntry("Guppy", 6)],
          logs: [],
        },
      ],
      species: [],
      reminders: { enabled: false, hour: 9 },
    } as unknown as AppState;

    const out = normalizeState(v3);
    expect(out.tanks[0].stock).toHaveLength(1);
    expect(out.tanks[0].stock[0].count).toBe(6);
    expect(out.species.map((s) => s.name)).toContain("Guppy");
  });
});

describe("mergeSpecies", () => {
  it("dedupes case-insensitively within a kind but not across kinds", () => {
    const cat = mergeSpecies([], [stockEntry("Java Fern", 1, "plant")]);
    const again = mergeSpecies(cat, [
      stockEntry("java fern", 2, "plant"), // dup (case)
      stockEntry("Java Fern", 1), // same name, livestock kind → new
      stockEntry("  ", 1), // blank → ignored
    ]);
    expect(again.filter((s) => s.kind === "plant")).toHaveLength(1);
    expect(again.filter((s) => s.kind === "livestock")).toHaveLength(1);
  });
});

describe("seed", () => {
  it("produces a self-consistent starter fishroom", () => {
    const s = seed();
    expect(s.version).toBe(3);
    expect(s.tanks.length).toBeGreaterThan(0);
    // every tank references a stack that exists
    const ids = new Set(s.stacks.map((st) => st.id));
    for (const t of s.tanks) expect(ids.has(t.stackId)).toBe(true);
    // the seeded room is a finished (closed) outline
    expect(s.room?.closed).toBe(true);
    expect((s.room?.points.length ?? 0)).toBeGreaterThanOrEqual(3);
    // every stocked species is in the running catalog
    const names = new Set(s.species.map((sp) => `${sp.kind}:${sp.name.toLowerCase()}`));
    for (const t of s.tanks) {
      for (const e of t.stock) {
        expect(names.has(`${e.kind}:${e.species.toLowerCase()}`)).toBe(true);
      }
    }
  });
});
