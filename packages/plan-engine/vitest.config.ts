import { defineConfig } from "vitest/config";

// Pure TS library — no DOM. Tests live next to source as `*.test.ts`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
