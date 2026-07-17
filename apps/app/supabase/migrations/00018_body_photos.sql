-- ============================================================================
-- 00018 — Body progress photos on body_logs + private storage bucket
--
-- «رحلتك الخاصة» grows from the mom to every eligible adult in the household
-- (children NEVER — the 00017 schema stance; the housekeeper NEVER — the same
-- dignity rule that keeps her out of workout plans: the employer does not
-- track her body). member_id already exists on body_logs, so per-member rows
-- need no schema change — this migration only adds the optional photo:
--
--   * body_logs.photo_path — storage object path of an optional progress
--     photo attached to a weigh-in. Path convention: <user_id>/<file> (flat,
--     one folder per account) so owner-scoped RLS and erasure stay one-step.
--   * storage bucket "body-photos" — PRIVATE (public=false). Photos render
--     only through short-lived signed URLs on the private journey page.
--     5 MB cap + image-only mime allowlist at the bucket level (defense in
--     depth; the client validates first).
--   * storage.objects policies — owner-scoped by the first path segment,
--     mirroring the house RLS pattern (auth.uid() = user_id).
--
-- PDPL: DB rows cascade from profiles(id), but storage objects do NOT cascade
-- — eraseUserAccount() removes the account's body-photos folder explicitly.
-- /api/account/export lists each log's photo as a signed URL (best-effort).
--
-- Style per 00005/00013/00016/00017: idempotent (IF NOT EXISTS + guarded
-- drops), additive. Applied MANUALLY to prod (no runner) — run after 00017,
-- then re-run scripts/verify-migrations.sql (now covers 00018) and
-- `pnpm --filter @fitlife/app db:types`.
-- ============================================================================

-- ── body_logs.photo_path ────────────────────────────────────────────────────
alter table public.body_logs
  add column if not exists photo_path text;

comment on column public.body_logs.photo_path is
  'Optional progress photo: storage object path in the private body-photos bucket (<user_id>/<file>). Never exposed publicly — signed URLs only.';

-- ── private storage bucket ──────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'body-photos',
  'body-photos',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── owner-scoped storage policies ───────────────────────────────────────────
-- Path convention <user_id>/<file>: the first folder segment IS the owner.
drop policy if exists "Users read own body photos" on storage.objects;
create policy "Users read own body photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users upload own body photos" on storage.objects;
create policy "Users upload own body photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own body photos" on storage.objects;
create policy "Users update own body photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own body photos" on storage.objects;
create policy "Users delete own body photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
