import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves project sites from /<repo-name>/. Keep this in sync with the repo name.
const BASE = "/PersonalCosts/";

export default defineConfig({
  base: BASE,
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // We ship our own manifest in public/ so it's easy to edit by hand.
      manifest: false,
      includeAssets: ["icons/*.png", "manifest.webmanifest"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        navigateFallback: `${BASE}index.html`,
        // Firestore/Auth traffic must never be served from the SW cache.
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
});
