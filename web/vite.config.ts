import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 38838,
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:38883",
        changeOrigin: true,
      },
    },
  },
});
