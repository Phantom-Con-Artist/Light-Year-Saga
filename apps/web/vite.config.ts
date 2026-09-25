import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, open: false },
  // satellite.js ships an optional WebAssembly worker that uses top-level await (unused here, but still bundled).
  worker: { format: "es" },
});
