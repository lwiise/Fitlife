// Delete EVERY account this harness has ever created, from the append-only
// ledger, and prove each one is gone.
//
// cleanup.mjs takes one email. That was fine for a single smoke run and stopped
// being fine at 38 accounts across four rounds — and the accounts are real rows
// on production, so "I think I got them all" is not an acceptable end state.
//
// Reads matrix-accounts.jsonl (every account ever, not just the latest per
// persona — the keyed ledger it replaced silently orphaned 12 live accounts by
// overwriting them on re-runs).
//
// A missing account is a PASS: an already-deleted account and a never-created
// one are both "not on production", which is the property we care about.
//
//   node cleanup-all.mjs [--dry-run] [--concurrency=2]

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { discoverSupabaseCreds, PASSWORD } from "./creds.mjs";

const LEDGER = "matrix-accounts.jsonl";
const DRY = process.argv.includes("--dry-run");
const arg = (k) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : null;
};
const CONCURRENCY = Number(arg("concurrency") ?? 2);

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

function readLedger() {
  if (!existsSync(LEDGER)) throw new Error(`${LEDGER} not found — nothing to clean`);
  const seen = new Set();
  const out = [];
  for (const line of readFileSync(LEDGER, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.email && !seen.has(row.email)) {
        seen.add(row.email);
        out.push(row);
      }
    } catch {
      /* a torn line costs one row, not the file */
    }
  }
  return out;
}

/** Does this account still exist? Sign-in is the only check available to us. */
async function stillExists(creds, email) {
  const sb = createClient(creds.url, creds.anon);
  const { data, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) return false;
  await sb.auth.signOut().catch(() => {});
  return Boolean(data?.user);
}

function runCleanup(email) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["cleanup.mjs", email], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const killer = setTimeout(() => child.kill("SIGKILL"), 4 * 60_000);
    child.on("close", (code) => {
      clearTimeout(killer);
      resolve({ code, out });
    });
  });
}

async function pool(items, n, fn) {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return results;
}

const creds = await discoverSupabaseCreds();
const accounts = readLedger();
log(`ledger holds ${accounts.length} distinct accounts`);

if (DRY) {
  const alive = await pool(accounts, 4, async (a) => ({
    ...a,
    alive: await stillExists(creds, a.email).catch(() => null),
  }));
  for (const a of alive) {
    log(`${a.alive === null ? "?" : a.alive ? "LIVE" : "gone"}  ${a.key.padEnd(24)} ${a.email}`);
  }
  log(`live: ${alive.filter((a) => a.alive).length} / ${alive.length}`);
  process.exit(0);
}

const results = await pool(accounts, CONCURRENCY, async (a) => {
  if (!(await stillExists(creds, a.email).catch(() => true))) {
    log(`already gone   ${a.key.padEnd(24)} ${a.email}`);
    return { ...a, outcome: "already-gone" };
  }
  const { out } = await runCleanup(a.email);
  // Trust the DB, not the script's own exit code: the whole point is proof.
  const gone = !(await stillExists(creds, a.email).catch(() => true));
  log(`${gone ? "DELETED      " : "!! STILL LIVE"} ${a.key.padEnd(24)} ${a.email}`);
  return { ...a, outcome: gone ? "deleted" : "FAILED", log: gone ? undefined : out.slice(-800) };
});

const failed = results.filter((r) => r.outcome === "FAILED");
writeFileSync("cleanup-report.json", JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));

log("");
log(`deleted ${results.filter((r) => r.outcome === "deleted").length}`);
log(`already gone ${results.filter((r) => r.outcome === "already-gone").length}`);
log(`FAILED ${failed.length}`);
for (const f of failed) log(`  !! ${f.email}`);
log(`report → cleanup-report.json`);
process.exit(failed.length ? 1 : 0);
