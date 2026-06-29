// Cloud sync via Supabase — fully optional and gated behind env vars.
//
// Security model (enforced server-side by Row-Level Security; see
// docs/INTEGRATION.md): the anon key shipped here can only READ rows that are
// marked shared. Writing requires the signed-in owner. Private tanks never
// leave the device — we only upload the PUBLIC contract (shared tanks).

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import type { AppState } from "./types";
import { toPublicData } from "./contract";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TABLE = "aquarium_snapshots";

export function isSyncConfigured(): boolean {
  return Boolean(URL && KEY);
}

let clientPromise: Promise<SupabaseClient> | null = null;
async function getClient(): Promise<SupabaseClient> {
  if (!isSyncConfigured()) throw new Error("Sync not configured");
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(URL as string, KEY as string, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    );
  }
  return clientPromise;
}

export interface SyncState {
  configured: boolean;
  signedIn: boolean;
  email?: string;
  busy: boolean;
  /** Network reachability (from the browser's online/offline events). */
  online: boolean;
  /** A change is waiting to be pushed (deferred while offline/busy). */
  pending: boolean;
  lastPushed?: number;
  message?: string;
  error?: string;
}

const MAX_RETRY_DELAY_MS = 60_000;

export interface UseSync extends SyncState {
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  pushNow: () => Promise<void>;
}

export function useSync(state: AppState, now: number): UseSync {
  const configured = isSyncConfigured();
  const [s, setS] = useState<SyncState>({
    configured,
    signedIn: false,
    busy: false,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    pending: false,
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const pushTimer = useRef<number | undefined>(undefined);
  const retryTimer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);
  const retries = useRef(0);

  // Track network reachability so we don't push into the void while offline.
  useEffect(() => {
    const goOnline = () => setS((p) => ({ ...p, online: true }));
    const goOffline = () => setS((p) => ({ ...p, online: false }));
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Track auth session
  useEffect(() => {
    if (!configured) return;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const c = await getClient();
        const { data } = await c.auth.getSession();
        applySession(data.session);
        const { data: sub } = c.auth.onAuthStateChange((_e, session) =>
          applySession(session)
        );
        unsub = () => sub.subscription.unsubscribe();
      } catch (e) {
        setS((p) => ({ ...p, error: msg(e) }));
      }
    })();
    return () => unsub?.();
    function applySession(session: Session | null) {
      setS((p) => ({
        ...p,
        signedIn: Boolean(session),
        email: session?.user?.email ?? undefined,
      }));
    }
  }, [configured]);

  // Schedule a backoff retry after a failed push (network blips, transient
  // 5xx). Capped, and only while there's still something to publish.
  const scheduleRetry = useCallback(() => {
    if (!stateRef.current.sync?.publish) return;
    const attempt = retries.current++;
    const delay = Math.min(MAX_RETRY_DELAY_MS, 2000 * 2 ** Math.min(attempt, 5));
    window.clearTimeout(retryTimer.current);
    retryTimer.current = window.setTimeout(() => void pushNow(), delay);
  }, []);

  const pushNow = useCallback(async () => {
    if (!configured) return;
    // Coalesce overlapping pushes; the trailing change is picked up by the
    // debounced auto-push effect or the next manual trigger.
    if (inFlight.current) {
      setS((p) => ({ ...p, pending: true }));
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setS((p) => ({
        ...p,
        pending: true,
        busy: false,
        error: "You're offline — changes will sync when you reconnect.",
      }));
      return;
    }

    inFlight.current = true;
    setS((p) => ({ ...p, busy: true, error: undefined, message: undefined }));
    try {
      const c = await getClient();
      const { data: auth } = await c.auth.getUser();
      if (!auth.user) throw new Error("Sign in first.");
      const cur = stateRef.current;
      const slug = (cur.sync?.slug || import.meta.env.VITE_AQUARIUM_SLUG || "default").trim();
      const payload = toPublicData(cur, Date.now());
      const { error } = await c
        .from(TABLE)
        .upsert(
          {
            owner: auth.user.id,
            slug,
            shared: Boolean(cur.sync?.publish),
            data: payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "owner,slug" }
        );
      if (error) throw error;
      retries.current = 0;
      window.clearTimeout(retryTimer.current);
      setS((p) => ({
        ...p,
        busy: false,
        pending: false,
        lastPushed: Date.now(),
        message: `Synced ${payload.tanks.length} shared tank${payload.tanks.length === 1 ? "" : "s"}.`,
      }));
    } catch (e) {
      setS((p) => ({ ...p, busy: false, error: msg(e) }));
      scheduleRetry();
    } finally {
      inFlight.current = false;
    }
  }, [configured, scheduleRetry]);

  const signIn = useCallback(
    async (email: string) => {
      if (!configured) return;
      setS((p) => ({ ...p, busy: true, error: undefined, message: undefined }));
      try {
        const c = await getClient();
        const { error } = await c.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.href },
        });
        if (error) throw error;
        setS((p) => ({
          ...p,
          busy: false,
          message: "Check your email for a sign-in link.",
        }));
      } catch (e) {
        setS((p) => ({ ...p, busy: false, error: msg(e) }));
      }
    },
    [configured]
  );

  const signOut = useCallback(async () => {
    if (!configured) return;
    const c = await getClient();
    await c.auth.signOut();
    setS((p) => ({ ...p, signedIn: false, email: undefined, message: undefined }));
  }, [configured]);

  // Auto-push (debounced) when signed in and publishing is on. Re-runs when
  // the data changes or when connectivity is restored, so a change made
  // offline syncs as soon as we're back online.
  useEffect(() => {
    if (!configured || !s.signedIn || !state.sync?.publish || !s.online) return;
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void pushNow(), 4000);
    return () => window.clearTimeout(pushTimer.current);
  }, [configured, s.signedIn, s.online, state, state.sync?.publish, pushNow]);

  // Clear any pending retry timer on unmount.
  useEffect(
    () => () => {
      window.clearTimeout(retryTimer.current);
      window.clearTimeout(pushTimer.current);
    },
    []
  );

  void now;
  return { ...s, signIn, signOut, pushNow };
}

function msg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as Error).message);
  return String(e);
}
