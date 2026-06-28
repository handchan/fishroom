import { useEffect, useRef } from "react";
import type { ReminderSettings, Tank } from "./types";
import { getStatus } from "./status";

const NOTIFY_KEY = "fishroom.notify.v1";

interface NotifyMemory {
  /** YYYY-MM-DD of the last daily summary we sent. */
  lastSummary?: string;
  /** tankId -> ISO timestamp we last alerted it as overdue. */
  perTank: Record<string, string>;
  /**
   * Set once after the first reminder cycle. Before this, we silently record
   * already-overdue tanks instead of firing a burst — the daily summary covers
   * the existing backlog; per-tank alerts are reserved for new transitions.
   */
  primed?: boolean;
}

function loadMem(): NotifyMemory {
  try {
    const raw = localStorage.getItem(NOTIFY_KEY);
    if (raw) return JSON.parse(raw) as NotifyMemory;
  } catch {
    /* ignore */
  }
  return { perTank: {} };
}
function saveMem(m: NotifyMemory) {
  try {
    localStorage.setItem(NOTIFY_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function permissionState(): NotificationPermission {
  if (!notificationsSupported()) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Show a notification. Prefers the service-worker registration (required for
 * installed PWAs, especially on iOS); falls back to the page Notification API.
 */
export async function showNotification(
  title: string,
  body: string,
  tag?: string
): Promise<boolean> {
  if (permissionState() !== "granted") return false;
  const options: NotificationOptions = {
    body,
    tag,
    icon: "./pwa-192.png",
    badge: "./pwa-192.png",
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    /* fall through to page notification */
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Tanks that are due, overdue, or never changed. */
export function dueTanks(tanks: Tank[], now = Date.now()): Tank[] {
  return tanks.filter((t) => {
    const lvl = getStatus(t, now).level;
    return lvl === "due" || lvl === "overdue" || lvl === "never";
  });
}

const ALERT_COOLDOWN_MS = 18 * 60 * 60 * 1000; // don't re-alert a tank within 18h

/**
 * While the app is open (or alive in the background), surface reminders:
 *  - a once-a-day summary at/after the chosen hour, and
 *  - per-tank alerts when a tank becomes overdue.
 *
 * Serverless PWAs can't wake themselves when fully closed, so these fire on
 * open and on the in-app tick. Installing to the Home Screen keeps it alive
 * longer in the background.
 */
export function useReminders(
  tanks: Tank[],
  settings: ReminderSettings,
  now: number
) {
  const tanksRef = useRef(tanks);
  tanksRef.current = tanks;

  useEffect(() => {
    if (!settings.enabled || permissionState() !== "granted") return;
    const list = tanksRef.current;
    const mem = loadMem();
    const date = new Date(now);
    let changed = false;

    // First run after enabling: silently record the existing backlog so we
    // don't fire a notification per already-overdue tank. The daily summary
    // surfaces the current list instead.
    const priming = !mem.primed;
    if (priming) {
      for (const t of list) {
        const lvl = getStatus(t, now).level;
        if (lvl === "overdue" || lvl === "never") {
          mem.perTank[t.id] = new Date(now).toISOString();
        }
      }
      mem.primed = true;
      changed = true;
    }

    // Per-tank overdue alerts (for tanks that newly cross into overdue)
    for (const t of list) {
      const lvl = getStatus(t, now).level;
      if (lvl === "overdue" || lvl === "never") {
        const last = mem.perTank[t.id]
          ? new Date(mem.perTank[t.id]).getTime()
          : 0;
        if (now - last > ALERT_COOLDOWN_MS) {
          mem.perTank[t.id] = new Date(now).toISOString();
          changed = true;
          void showNotification(
            "💧 Water change due",
            `${t.name} hasn't had a water change in a while.`,
            `tank-${t.id}`
          );
        }
      } else if (mem.perTank[t.id]) {
        // recovered — clear so it can alert again next cycle
        delete mem.perTank[t.id];
        changed = true;
      }
    }

    // Daily summary at/after the chosen hour
    const key = todayKey(date);
    if (date.getHours() >= settings.hour && mem.lastSummary !== key) {
      const due = dueTanks(list, now);
      if (due.length > 0) {
        mem.lastSummary = key;
        changed = true;
        const names = due.slice(0, 3).map((t) => t.name).join(", ");
        void showNotification(
          `🐟 ${due.length} ${due.length === 1 ? "tank needs" : "tanks need"} attention`,
          due.length <= 3 ? names : `${names} and ${due.length - 3} more`,
          "daily-summary"
        );
      } else {
        mem.lastSummary = key; // nothing due; mark handled
        changed = true;
      }
    }

    if (changed) saveMem(mem);
  }, [now, settings.enabled, settings.hour]);
}

export { NOTIFY_KEY };
