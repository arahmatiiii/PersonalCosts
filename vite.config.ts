import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

// base "./" + a single inlined index.html: the same build works on GitHub Pages
// (any repo name / sub-path) and inside the Capacitor Android WebView.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
});
