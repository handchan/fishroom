/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL — enables cloud sync when set. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (publishable) key — safe to ship; access is gated by RLS. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Default slug your personal site reads from (e.g. "hengchengyu"). */
  readonly VITE_AQUARIUM_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
