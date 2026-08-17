import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    port: parseInt(process.env.VITE_DEV_PORT || "3000", 10),
  },
  preview: {
    port: parseInt(process.env.VITE_PREVIEW_PORT || "4173", 10),
  },
  build: {
    outDir: "dist",
  },
});
