import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Build to a relative base so the app works whether served from a domain
// root or a project subpath (e.g. GitHub Pages at /react-koi-pond/).
export default defineConfig({
  base: "./",
  // Honor a PORT env var when provided (e.g. preview tooling) without
  // affecting the default local dev port.
  server: { port: Number(process.env.PORT) || 5173 },
  plugins: [
    react(),
    VitePWA({
      // Prompt the user before reloading: an auto-reload could interrupt them
      // mid-edit. We surface an in-app "Update" toast (see useAppUpdate).
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Fishroom — Aquarium Tracker",
        short_name: "Fishroom",
        description:
          "Track water changes and feedings across your aquariums. Visual fishroom map and quick-edit list.",
        theme_color: "#faf9f5",
        background_color: "#faf9f5",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "index.html",
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
