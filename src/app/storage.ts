import { useCallback, useEffect, useState } from "react";
import type {
  AppState,
  LogEntry,
  Pt,
  ReminderSettings,
  SpeciesRecord,
  Stack,
  StockEntry,
  StockKind,
  SyncSettings,
  Tank,
} from "./types";
import { uid } from "./status";

const STORAGE_KEY = "fishroom.state.v2";
const LEGACY_KEY = "fishroom.state.v1";
const STATE_VERSION = 3;

const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, hour: 9 };
const DEFAULT_SYNC: SyncSettings = {
  slug: import.meta.env.VITE_AQUARIUM_SLUG ?? "",
  publish: false,
};

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** Case-insensitive identity of a species within the catalog. */
function catalogKey(name: string, kind: StockKind): string {
  return `${kind}:${name.trim().toLowerCase()}`;
}

/** Add any species from `entries` that the catalog doesn't know yet. */
export function mergeSpecies(
  catalog: SpeciesRecord[],
  entries: StockEntry[]
): SpeciesRecord[] {
  const have = new Set(catalog.map((s) => catalogKey(s.name, s.kind)));
  let next = catalog;
  for (const e of entries) {
    const name = e.species.trim();
    if (!name) continue;
    const key = catalogKey(name, e.kind);
    if (!have.has(key)) {
      have.add(key);
      next = [...next, { id: uid(), name, kind: e.kind }];
    }
  }
  return next;
}

/** Shorthand for building seed/test stock entries. */
export function stockEntry(
  species: string,
  count = 1,
  kind: StockKind = "livestock"
): StockEntry {
  return { id: uid(), species, kind, count };
}

/** A small starter fishroom — includes a couple of racks with stacked tanks. */
export function seed(): AppState {
  const stacks: Stack[] = [
    { id: "s1", x: 0.26, y: 0.34, label: "Main rack" },
    { id: "s2", x: 0.7, y: 0.32, label: "Shrimp rack" },
    { id: "s3", x: 0.5, y: 0.66, label: "Reef stand" },
    { id: "s4", x: 0.8, y: 0.7, label: "QT" },
  ];

  const mk = (
    name: string,
    volumeGallons: number,
    stackId: string,
    shelf: number,
    waterChangeIntervalDays: number,
    daysSinceChange: number,
    daysSinceFeed: number,
    extra: Partial<Tank> = {}
  ): Tank => ({
    id: uid(),
    name,
    volumeGallons,
    waterType: "freshwater",
    waterChangeIntervalDays,
    defaultChangePercent: 30,
    stackId,
    shelf,
    stock: [],
    notes: "",
    createdAt: daysAgoISO(120),
    logs: [
      {
        id: uid(),
        date: daysAgoISO(daysSinceChange),
        type: "water_change",
        percent: 30,
      },
      { id: uid(), date: daysAgoISO(daysSinceFeed), type: "feeding" },
    ],
    ...extra,
  });

  const tanks = [
    // Main rack — three tanks stacked
    mk("Community 75g", 75, "s1", 0, 7, 2, 0, {
      waterType: "planted",
      stock: [
        stockEntry("Cardinal tetra", 12),
        stockEntry("Kuhli loach", 4),
        stockEntry("Otocinclus", 3),
        stockEntry("Amazon sword", 2, "plant"),
        stockEntry("Java fern", 5, "plant"),
      ],
      tempF: 78,
    }),
    mk("Grow-out 20L", 20, "s1", 1, 5, 1, 0, {
      stock: [stockEntry("Angelfish fry", 30)],
    }),
    mk("Betta 5g", 5, "s1", 2, 7, 9, 1, {
      stock: [stockEntry("Galaxy betta", 1)],
      notes: "Sponge filter — rinse in old tank water.",
      tempF: 80,
    }),
    // Shrimp rack — two stacked
    mk("Blue Dream 10g", 10, "s2", 0, 10, 4, 2, {
      waterType: "planted",
      stock: [
        stockEntry("Blue dream neocaridina", 25),
        stockEntry("Java moss", 1, "plant"),
        stockEntry("Anubias nana", 3, "plant"),
      ],
      notes: "Remineralize RO to GH 6 / KH 1.",
    }),
    mk("Sakura 10g", 10, "s2", 1, 10, 11, 2, {
      waterType: "planted",
      stock: [
        stockEntry("Sakura cherry shrimp", 20),
        stockEntry("Java moss", 1, "plant"),
      ],
    }),
    // Reef stand — single
    mk("Reef 40B", 40, "s3", 0, 14, 16, 0, {
      waterType: "saltwater",
      stock: [
        stockEntry("Ocellaris clownfish", 2),
        stockEntry("Cleaner shrimp", 1),
        stockEntry("Zoanthid frag", 3),
      ],
      tempF: 77,
    }),
    // QT — single
    mk("Quarantine 10g", 10, "s4", 0, 4, 5, 1, {
      notes: "Empty between uses — keep cycled with ammonia.",
    }),
  ];

  return {
    version: STATE_VERSION,
    room: {
      points: [
        { x: 0.1, y: 0.16 },
        { x: 0.9, y: 0.16 },
        { x: 0.9, y: 0.84 },
        { x: 0.1, y: 0.84 },
      ],
      closed: true,
    },
    stacks,
    reminders: DEFAULT_REMINDERS,
    sync: DEFAULT_SYNC,
    tanks,
    species: mergeSpecies([], tanks.flatMap((t) => t.stock)),
  };
}

/** A tank as persisted by older versions — may have free-text livestock. */
interface LegacyTank extends Omit<Tank, "stock"> {
  x?: number;
  y?: number;
  stock?: StockEntry[];
  /** v1/v2: comma-separated free text, e.g. "Cardinal tetras, otos". */
  livestock?: string;
}

/** v2 → v3: split the free-text livestock field into structured entries. */
function migrateTankStock(t: LegacyTank): Tank {
  const { livestock, ...rest } = t;
  if (Array.isArray(t.stock)) return { ...rest, stock: t.stock };
  const stock: StockEntry[] = (livestock ?? "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ id: uid(), species: name, kind: "livestock" as const, count: 1 }));
  return { ...rest, stock };
}

/**
 * Bring any persisted/imported state (v2 saves, backups, migrated v1) up to
 * the current shape: structured stock, species catalog, room flag, defaults.
 */
export function normalizeState(parsed: AppState): AppState {
  const tanks = (parsed.tanks as unknown as LegacyTank[]).map(migrateTankStock);
  const species = mergeSpecies(
    Array.isArray(parsed.species) ? parsed.species : [],
    tanks.flatMap((t) => t.stock)
  );
  return {
    ...parsed,
    version: STATE_VERSION,
    tanks,
    species,
    // Legacy rooms (saved before the open/closed flag) are finished.
    room:
      parsed.room && parsed.room.closed === undefined
        ? { ...parsed.room, closed: true }
        : parsed.room,
    reminders: parsed.reminders ?? DEFAULT_REMINDERS,
    sync: parsed.sync ?? DEFAULT_SYNC,
  };
}

/** Migrate a v1 state (free-floating tanks with x/y) into stacks. */
export function migrateV1(raw: string): AppState | null {
  try {
    const old = JSON.parse(raw) as { tanks?: LegacyTank[] };
    if (!old || !Array.isArray(old.tanks)) return null;
    const stacks: Stack[] = [];
    const tanks = old.tanks.map((t) => {
      const id = "s_" + (t.id ?? uid());
      stacks.push({ id, x: t.x ?? 0.5, y: t.y ?? 0.5 });
      const { x: _x, y: _y, ...rest } = t;
      void _x;
      void _y;
      return { ...rest, stackId: id, shelf: 0 };
    });
    return normalizeState({
      version: STATE_VERSION,
      stacks,
      tanks: tanks as unknown as Tank[],
      species: [],
      reminders: DEFAULT_REMINDERS,
      sync: DEFAULT_SYNC,
    });
  } catch {
    return null;
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.tanks) && Array.isArray(parsed.stacks)) {
        return normalizeState(parsed);
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateV1(legacy);
      if (migrated) return migrated;
    }
    return seed();
  } catch {
    return seed();
  }
}

/** Persist state. Returns false if the write failed (quota/private mode). */
function save(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // storage full / private mode — app still works in-memory this session.
    return false;
  }
}

/** Drop stacks that no longer have any tanks on them. */
function pruneStacks(s: AppState): AppState {
  const used = new Set(s.tanks.map((t) => t.stackId));
  return { ...s, stacks: s.stacks.filter((st) => used.has(st.id)) };
}

export function useFishroom() {
  const [state, setState] = useState<AppState>(() => load());
  /** False once a persist has failed — surfaced to warn the user. */
  const [persisted, setPersisted] = useState(true);

  useEffect(() => {
    setPersisted(save(state));
  }, [state]);

  const upsertTank = useCallback((tank: Tank, ensureStack?: Stack) => {
    setState((s) => {
      const i = s.tanks.findIndex((t) => t.id === tank.id);
      const tanks = [...s.tanks];
      if (i >= 0) tanks[i] = tank;
      else tanks.push(tank);
      let stacks = s.stacks;
      if (ensureStack && !stacks.some((st) => st.id === ensureStack.id)) {
        stacks = [...stacks, ensureStack];
      }
      // Any new species on this tank joins the running catalog.
      const species = mergeSpecies(s.species, tank.stock);
      return pruneStacks({ ...s, stacks, tanks, species });
    });
  }, []);

  /** Remove a species from the catalog (used for unused-entry cleanup). */
  const removeSpecies = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      species: s.species.filter((sp) => sp.id !== id),
    }));
  }, []);

  const removeTank = useCallback((id: string) => {
    setState((s) =>
      pruneStacks({ ...s, tanks: s.tanks.filter((t) => t.id !== id) })
    );
  }, []);

  const moveStack = useCallback((id: string, x: number, y: number) => {
    setState((s) => ({
      ...s,
      stacks: s.stacks.map((st) => (st.id === id ? { ...st, x, y } : st)),
    }));
  }, []);

  const setStackLabel = useCallback((id: string, label: string) => {
    setState((s) => ({
      ...s,
      stacks: s.stacks.map((st) => (st.id === id ? { ...st, label } : st)),
    }));
  }, []);

  const addLog = useCallback((id: string, entry: Omit<LogEntry, "id">) => {
    setState((s) => ({
      ...s,
      tanks: s.tanks.map((t) =>
        t.id === id
          ? {
              ...t,
              // keep the tank's current temp in sync with the latest reading
              tempF:
                entry.type === "temp_test" && typeof entry.tempF === "number"
                  ? entry.tempF
                  : t.tempF,
              logs: [{ ...entry, id: uid() }, ...t.logs].sort(
                (a, b) => +new Date(b.date) - +new Date(a.date)
              ),
            }
          : t
      ),
    }));
  }, []);

  /** Mark every tank fed right now (one feeding log each). */
  const feedAll = useCallback(() => {
    const date = new Date().toISOString();
    setState((s) => ({
      ...s,
      tanks: s.tanks.map((t) => ({
        ...t,
        logs: [{ id: uid(), date, type: "feeding" as const }, ...t.logs],
      })),
    }));
  }, []);

  const removeLog = useCallback((tankId: string, logId: string) => {
    setState((s) => ({
      ...s,
      tanks: s.tanks.map((t) =>
        t.id === tankId
          ? { ...t, logs: t.logs.filter((l) => l.id !== logId) }
          : t
      ),
    }));
  }, []);

  const setRoom = useCallback((points: Pt[]) => {
    setState((s) => ({
      ...s,
      // Persist points as they're drawn (even 1–2) so a new room can be built
      // up tap-by-tap; an empty array clears the room. A fresh outline starts
      // open (connect-the-dots); edits to an existing room keep its flag.
      room:
        points.length > 0
          ? { points, closed: s.room?.closed ?? false }
          : undefined,
    }));
  }, []);

  /** Finish the outline so it renders as a filled polygon. */
  const closeRoom = useCallback(() => {
    setState((s) =>
      s.room && s.room.points.length >= 3
        ? { ...s, room: { ...s.room, closed: true } }
        : s
    );
  }, []);

  const setReminders = useCallback((reminders: ReminderSettings) => {
    setState((s) => ({ ...s, reminders }));
  }, []);

  const setSync = useCallback((sync: SyncSettings) => {
    setState((s) => ({ ...s, sync }));
  }, []);

  const replaceState = useCallback((next: AppState) => {
    // Imported backups may predate the current shape — normalize them.
    setState(normalizeState(next));
  }, []);

  return {
    state,
    persisted,
    upsertTank,
    removeTank,
    moveStack,
    setStackLabel,
    addLog,
    feedAll,
    removeLog,
    setRoom,
    closeRoom,
    setReminders,
    setSync,
    replaceState,
    removeSpecies,
  };
}

/** Build a fresh tank, optionally onto an existing stack. */
export function newTank(stackId: string, shelf: number, partial: Partial<Tank> = {}): Tank {
  return {
    id: uid(),
    name: "New Tank",
    volumeGallons: 20,
    waterType: "freshwater",
    waterChangeIntervalDays: 7,
    defaultChangePercent: 30,
    stackId,
    shelf,
    stock: [],
    notes: "",
    createdAt: new Date().toISOString(),
    logs: [],
    ...partial,
  };
}

export function newStack(x = 0.5, y = 0.5, label?: string): Stack {
  return { id: uid(), x, y, label };
}

export { STORAGE_KEY };
