import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Los tests de componentes .tsx necesitan el runtime JSX automático (React 19).
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Los tests de componentes declaran `@vitest-environment jsdom` en su cabecera;
    // el resto sigue siendo `node` porque solo ejercita funciones puras.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});