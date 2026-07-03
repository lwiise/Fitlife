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
    // env.ts fail-fasts on NEXT_PUBLIC_* at module load, so tests that import
    // server modules (e.g. lib/subscription/state) need non-empty placeholders.
    // Same throwaway values the CI build step uses — NOT secrets.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-placeholder-anon-key",
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
      NEXT_PUBLIC_WEB_URL: "https://web.example.com",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(here, "src"),
      "server-only": path.resolve(here, "test/stub-empty.ts"),
      "client-only": path.resolve(here, "test/stub-empty.ts"),
    },
  },
});
