import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Tauri loads the dev server on a fixed port and the built files from dist/.
// Two pages: the app, and the desktop lyrics window.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 4163, strictPort: true },
  build: { rollupOptions: { input: ["index.html", "desktop-lyrics.html"] } },
});
