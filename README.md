# 🐟 Fishroom — Aquarium Tracker

An installable iPhone app (PWA) for tracking **water changes** and **feedings**
across all the aquariums in your fishroom.

- **🗺️ Fishroom map** — lay out your room the way it really is:
  - **Draw the room** outline — tap **✏️ Draw room**, tap to drop corners, and
    drag the dots to match your walls.
  - **Racks with stacked tanks** — tanks live on racks/stands, so a single spot
    can hold several tanks stacked on shelves. Each rack shows its shelves
    sized by volume and **coloured by water-change status** (green = fresh →
    red = needs a change), with a badge for how many need attention.
  - **Tap a rack to expand it** into its stacked tanks for per-shelf logging and
    editing; **drag** racks to arrange them in the room.
- **📋 List view** — every tank sorted by urgency for quick, one-tap logging:
  **Water ✓** and **Fed ✓** buttons, status pills, and last-event times.
- **📝 Per-tank detail** — log water changes / feedings, set the target change
  interval and typical %, record livestock, temperature, water type, and notes,
  and review a full event history.
- **🔔 Reminders** — opt-in notifications when tanks are due/overdue, plus a
  once-a-day summary at a time you pick. (See *Notifications on iPhone* below.)
- **📴 Offline-first** — all data lives on your device (localStorage). No
  account, no server, works on a plane. Add it to your Home Screen and it runs
  full-screen like a native app.
- **🪷 Ambient koi** — the map drifts over a subtle live koi pond (the original
  `react-koi-pond` canvas this repo started from).

> A native Swift/App Store build isn't used here: a PWA installs straight from
> Safari with no Xcode, no developer account, and no review — and gets you the
> same full-screen, offline, home-screen experience on iPhone.

## 📲 Install on your iPhone

1. Open the app's URL in **Safari** (see *Hosting* below — must be **https://**).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch it from your Home Screen. It opens full-screen with no browser chrome,
   works offline, and keeps your data on-device.

## 🔔 Notifications on iPhone

iOS only delivers web notifications to a PWA that's been **added to the Home
Screen**, and permission must be granted from inside that installed app. So:

1. Install to your Home Screen (above) and open it from there.
2. Tap the **🔔** button → toggle **Water-change reminders** on and allow
   notifications when prompted → optionally set the daily summary time.

Reminders fire while the app is open or alive in the background. A serverless,
on-device app can't wake itself once fully closed, so the daily summary lands
the next time you open the app on/after that hour — keep it on your Home Screen
and pop in daily for the most reliable nudges. (A backend push service could
deliver while fully closed; that's intentionally out of scope to keep your data
100% on-device.)

## 🚀 Hosting

This repo ships a GitHub Actions workflow
(`.github/workflows/deploy.yml`) that builds the app and publishes it to
**GitHub Pages** on every push.

To turn it on: **Repo → Settings → Pages → Build and deployment → Source:
GitHub Actions.** After the next push your app is live at
`https://<user>.github.io/react-koi-pond/`, ready to open in Safari and install.

The build uses a relative base (`base: "./"`), so it also works on Netlify,
Vercel, Cloudflare Pages, or any static host — just deploy the `dist/` folder.

## 🛠️ Develop locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit
```

Tech: **React 19 + TypeScript + Vite 6 + vite-plugin-pwa** (Workbox service
worker, web app manifest, offline precache).

## 📁 Structure

```
index.html              # iOS PWA meta tags (viewport-fit, apple-* tags)
vite.config.ts          # Vite + PWA manifest & service worker
public/                 # app icons (192/512, maskable, apple-touch)
src/
  main.tsx              # entry
  App.tsx               # shell: header, Map/List tabs, summary, sheet, toasts
  KoiPond.tsx           # ambient koi pond canvas (original component)
  app/
    types.ts            # Tank / Stack / Room / Reminder data model
    status.ts           # status levels, colour gradient, node + stack sizing
    storage.ts          # localStorage hook, v1→v2 migration, seed fishroom
    reminders.ts        # notification permission + due/summary scheduling
    FishroomMap.tsx     # room outline drawing + draggable racks
    RackSheet.tsx       # expanded rack — stacked tanks, per-shelf logging
    ListView.tsx        # urgency-sorted quick-log list
    TankSheet.tsx       # add/edit tank bottom sheet
    SettingsSheet.tsx   # reminders settings
    styles.css          # iOS-flavoured dark aquatic theme
```

## License

MIT
