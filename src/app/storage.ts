import { useCallback, useEffect, useState } from "react";
import type { AppState, LogEntry, Tank } from "./types";
import { uid } from "./status";

const STORAGE_KEY = "fishroom.state.v1";
const STATE_VERSION = 1;

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** A small starter fishroom so the app isn't empty on first launch. */
function seed(): AppState {
  const mk = (
    name: string,
    volumeGallons: number,
    x: number,
    y: number,
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
    x,
    y,
    livestock: "",
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

  return {
    version: STATE_VERSION,
    tanks: [
      mk("Community 75g", 75, 0.22, 0.26, 7, 2, 0, {
        waterType: "planted",
        livestock: "Cardinal tetras, kuhli loaches, otos",
        tempF: 78,
      }),
      mk("Betta Shelf", 5, 0.62, 0.2, 7, 9, 1, {
        livestock: "Galaxy betta",
        notes: "Sponge filter — rinse in old tank water.",
        tempF: 80,
      }),
      mk("Shrimp 10g", 10, 0.8, 0.46, 10, 4, 2, {
        waterType: "planted",
        livestock: "Blue dream neocaridina",
        notes: "Remineralize RO to GH 6 / KH 1.",
      }),
      mk("Reef 40B", 40, 0.3, 0.62, 14, 16, 0, {
        waterType: "saltwater",
        livestock: "Clownfish pair, cleaner shrimp, zoas",
        tempF: 77,
      }),
      mk("Grow-out 20L", 20, 0.66, 0.7, 5, 1, 0, {
        livestock: "Angelfish fry",
      }),
      mk("Quarantine 10g", 10, 0.12, 0.82, 4, 5, 1, {
        notes: "Empty between uses — keep cycled with ammonia.",
      }),
    ],
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || !Array.isArray(parsed.tanks)) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

function save(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full / private mode — ignore, app still works in-memory
  }
}

export function useFishroom() {
  const [state, setState] = useState<AppState>(() => load());

  useEffect(() => {
    save(state);
  }, [state]);

  const upsertTank = useCallback((tank: Tank) => {
    setState((s) => {
      const i = s.tanks.findIndex((t) => t.id === tank.id);
      const tanks = [...s.tanks];
      if (i >= 0) tanks[i] = tank;
      else tanks.push(tank);
      return { ...s, tanks };
    });
  }, []);

  const removeTank = useCallback((id: string) => {
    setState((s) => ({ ...s, tanks: s.tanks.filter((t) => t.id !== id) }));
  }, []);

  const setPosition = useCallback((id: string, x: number, y: number) => {
    setState((s) => ({
      ...s,
      tanks: s.tanks.map((t) => (t.id === id ? { ...t, x, y } : t)),
    }));
  }, []);

  const addLog = useCallback(
    (id: string, entry: Omit<LogEntry, "id">) => {
      setState((s) => ({
        ...s,
        tanks: s.tanks.map((t) =>
          t.id === id
            ? {
                ...t,
                logs: [{ ...entry, id: uid() }, ...t.logs].sort(
                  (a, b) => +new Date(b.date) - +new Date(a.date)
                ),
              }
            : t
        ),
      }));
    },
    []
  );

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

  const replaceAll = useCallback((next: AppState) => {
    setState({ version: STATE_VERSION, tanks: next.tanks ?? [] });
  }, []);

  return {
    state,
    upsertTank,
    removeTank,
    setPosition,
    addLog,
    removeLog,
    replaceAll,
  };
}

export function newTank(partial: Partial<Tank> = {}): Tank {
  return {
    id: uid(),
    name: "New Tank",
    volumeGallons: 20,
    waterType: "freshwater",
    waterChangeIntervalDays: 7,
    defaultChangePercent: 30,
    x: 0.5,
    y: 0.5,
    livestock: "",
    notes: "",
    createdAt: new Date().toISOString(),
    logs: [],
    ...partial,
  };
}

export { STORAGE_KEY };
