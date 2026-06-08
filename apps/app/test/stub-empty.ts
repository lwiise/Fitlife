// Stub for `server-only` / `client-only` in the Vitest (node) environment.
// These packages throw when imported outside their intended Next.js runtime;
// in unit tests we replace them with a no-op module via vitest.config alias.
export {};
