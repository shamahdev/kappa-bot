import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: "bun" }),
    viteReact(),
  ],
  server: {
    // Development-only same-origin API routing; manual production hosting
    // must provide the equivalent routing and HTTPS for Secure cookies.
    proxy: {
      "/api": process.env.SERVICE_URL ?? "http://localhost:3443",
    },
  },
});
