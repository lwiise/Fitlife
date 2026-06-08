import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

// App tests are pure-logic unit tests (no rendering): node environment. The `@/`
// alias mirrors tsconfig paths; `server-only`/`client-only` are stubbed because they
// throw outside their Next.js runtime and would break imports of server modules.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(here, "src"),
      "server-only": path.resolve(here, "test/stub-empty.ts"),
      "client-only": path.resolve(here, "test/stub-empty.ts"),
    },
  },
});
