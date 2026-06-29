# Connecting Fishroom to hengchengyu.com

This explains how the aquarium data is made **securely available** so your
personal site can read it under an `/aquarium` section.

## Design at a glance

- **On-device is the source of truth.** Everything works offline in
  `localStorage`. Cloud sync is opt-in.
- **Only shared tanks leave the device.** Each tank has a *Share to my site*
  toggle. The app uploads a **public contract** (see below) containing only
  shared tanks — private tanks are never uploaded at all.
- **Writes require the owner; reads are public-but-scoped.** The browser ships
  a Supabase *anon* (publishable) key. It is safe to expose because Postgres
  **Row-Level Security** lets the anon role only `SELECT` rows you've published,
  and never write. Writing requires you to be signed in.

```
  Fishroom PWA  ──(signed-in upsert)──►  Supabase (Postgres + RLS)
   (you, owner)                                 │
                                                ▼ (anon, read-only, shared rows)
                                   hengchengyu.com/aquarium
```

## 1. Create the Supabase table + policies

In your Supabase project → SQL editor, run:

```sql
create table if not exists public.aquarium_snapshots (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) default auth.uid(),
  slug        text not null,
  shared      boolean not null default false,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  unique (owner, slug)
);

alter table public.aquarium_snapshots enable row level security;

-- Anyone (anon key) may read ONLY published snapshots.
create policy "public can read shared snapshots"
  on public.aquarium_snapshots
  for select
  using (shared = true);

-- The signed-in owner has full control of their own rows.
create policy "owner manages own snapshots"
  on public.aquarium_snapshots
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
```

> The app only ever stores the public contract in `data`, so even a
> misconfiguration can't leak private tanks — they are not uploaded.

Optionally restrict who can sign in: Supabase → Authentication → keep email
sign-in on and add only your email, or disable new sign-ups after your first
login.

## 2. Configure the app

Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=ey...           # anon/publishable key (safe to ship)
VITE_AQUARIUM_SLUG=hengchengyu
```

Rebuild/redeploy. In the app: **🔔 → Settings → Connect your site**, sign in
with your email, set the slug, turn on **Publish to my site**, and the shared
snapshot syncs automatically (and on **Sync now**).

## 3. Read it from your site

Read-only, with the anon key (RLS guarantees you only get published rows):

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getAquarium() {
  const { data, error } = await supabase
    .from("aquarium_snapshots")
    .select("data, updated_at")
    .eq("slug", "hengchengyu")
    .eq("shared", true)
    .maybeSingle();
  if (error) throw error;
  return data?.data as AquariumData | null; // matches the contract below
}
```

No server needed; you can fetch this from a Server Component, a build step, or
the browser.

## The public data contract

Shape of `data` (also defined in `src/app/contract.ts` as `PublicAquariumData`).
`schemaVersion` is bumped on breaking changes so your site can branch on it.

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-29T12:00:00.000Z",
  "room": { "points": [{ "x": 0.1, "y": 0.16 }, ...] },   // normalized 0..1
  "racks": [{ "id": "s1", "label": "Main rack", "x": 0.26, "y": 0.34 }],
  "tanks": [
    {
      "id": "…",
      "name": "Reef 40B",
      "volumeGallons": 40,
      "waterType": "saltwater",
      "livestock": "Clownfish pair, …",
      "rackId": "s3",
      "rackLabel": "Reef stand",
      "status": "overdue",                  // fresh | ok | due | overdue | never
      "tempF": 78,
      "daysSinceWaterChange": 16,
      "daysSinceFeeding": 0,
      "lastWaterChange": "2026-06-13T…",
      "lastFeeding": "2026-06-29T…",
      "lastTempTest": "2026-06-29T…",
      "temperatures": [{ "date": "…", "tempF": 78 }],   // oldest → newest
      "waterChanges": [{ "date": "…", "percent": 30 }],
      "feedings": ["…"]
    }
  ]
}
```

The same status colors used in the app: `fresh` green → `due` amber →
`overdue`/`never` clay/brick. You can reuse `volumeGallons` to size nodes and
`x`/`y` on racks to lay out the fishroom map on your site.
