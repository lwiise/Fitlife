#!/usr/bin/env node
/**
 * Regenerate `src/lib/supabase/database.types.ts` WITHOUT Docker.
 *
 * `pnpm db:types` runs `supabase gen types typescript --local`, which needs the
 * Supabase CLI's local stack — and the CLI shells out to a Docker container
 * (`postgres-meta`) even when you pass `--db-url`. That makes it unusable
 * anywhere Docker is unavailable or the image registry is unreachable, which is
 * how the generated types silently fell five migrations behind the database.
 *
 * This drives the SAME generator the CLI would (`@supabase/postgres-meta`, the
 * version the pinned CLI requests) against any plain Postgres, so it works in a
 * sandbox or CI with nothing but a Postgres binary.
 *
 * Usage:
 *   1. Start a Postgres 16 cluster and create an empty database.
 *   2. psql "$DB" -f apps/app/scripts/supabase-shim.sql     # auth/storage stubs
 *   3. for f in apps/app/supabase/migrations/*.sql; do psql "$DB" -f "$f"; done
 *   4. node apps/app/scripts/gen-types-local.mjs "$DB" > src/lib/supabase/database.types.ts
 *
 * Verify the result by diffing against the committed file: the only changes
 * should be the migrations you added. Anything else means the shim or the
 * migration order is wrong.
 *
 * Requires `@supabase/postgres-meta` — install it on demand rather than adding a
 * dependency for a task that runs a few times a year:
 *   npm i --no-save @supabase/postgres-meta@0.96.6
 *
 * Keep the version in step with the `postgres-meta` image the pinned Supabase
 * CLI pulls, or the output will differ cosmetically from `pnpm db:types`.
 */

const connectionString = process.argv[2];
if (!connectionString) {
  console.error("usage: gen-types-local.mjs <postgres-connection-string>");
  process.exit(1);
}

const { PostgresMeta } = await import("@supabase/postgres-meta");
const { apply } = await import(
  "@supabase/postgres-meta/dist/server/templates/typescript.js"
);

const pgMeta = new PostgresMeta({ connectionString, max: 1 });
const included = ["public"];

const results = {
  schemas: await pgMeta.schemas.list(),
  tables: await pgMeta.tables.list({ includedSchemas: included, includeColumns: false }),
  foreignTables: await pgMeta.foreignTables.list({ includedSchemas: included, includeColumns: false }),
  views: await pgMeta.views.list({ includedSchemas: included, includeColumns: false }),
  materializedViews: await pgMeta.materializedViews.list({ includedSchemas: included, includeColumns: false }),
  columns: await pgMeta.columns.list({ includedSchemas: included }),
  relationships: await pgMeta.relationships.list(),
  functions: await pgMeta.functions.list({ includedSchemas: included }),
  types: await pgMeta.types.list({ includeArrayTypes: true, includeSystemSchemas: true }),
};

for (const [name, r] of Object.entries(results)) {
  if (r.error) {
    console.error(`failed to read ${name}:`, r.error);
    process.exit(1);
  }
}

process.stdout.write(
  await apply({
    schemas: results.schemas.data.filter((s) => included.includes(s.name)),
    tables: results.tables.data,
    foreignTables: results.foreignTables.data,
    views: results.views.data,
    materializedViews: results.materializedViews.data,
    columns: results.columns.data,
    relationships: results.relationships.data,
    // Trigger functions have no callable signature and are not emitted.
    functions: results.functions.data.filter((f) => f.return_type !== "trigger"),
    types: results.types.data,
    detectOneToOneRelationships: true,
    // Matches the PostgrestVersion recorded in the committed types.
    postgrestVersion: process.env.PGRST_VERSION || "14.5",
  }),
);

await pgMeta.end();
