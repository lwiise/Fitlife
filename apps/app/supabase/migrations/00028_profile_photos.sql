-- ============================================================================
-- 00028 — Profile photos for the account owner and every family member
--
-- Owner request (09/2026): a profile picture for the main user and for each
-- member of the family, shown wherever that person appears in the app (the
-- header, /family, the plan bar and member switcher, «موسم بيتنا»). Until now
-- every avatar was an initial on a roster colour.
--
--   * public.profile_photos — one row per person who has a photo:
--     (user_id, member_id) → path. member_id is TEXT carrying the house
--     identity ("mom" | family_members.id), the same convention as the
--     engagement tables, so removeFamilyMember's purge covers it.
--
--     A SEPARATE TABLE, NOT A COLUMN, ON PURPOSE: family_members carries the
--     generic updated_at trigger, and staleMemberIds() reads a member row
--     newer than the plan as an edit the plan has not absorbed yet — the
--     drain then dispatches a PAID regeneration for them. A photo column on
--     that row would have turned every new photo into a plan rebuild. A
--     photo is not a plan input, so it does not live on the row that is.
--
--   * storage bucket "profile-photos" — PRIVATE (public=false). Path
--     convention <user_id>/<member_id>-<uuid>.<ext>: flat, one folder per
--     account (owner-scoped RLS and erasure stay one step), a removed
--     member's objects are found by prefix, and a new photo is always a NEW
--     object, so the app can cache a served photo as immutable. The app
--     serves a photo only through /api/profile-photo, which checks the
--     session and reads with the caller's own client (so the policies below
--     apply). The browser uploads nothing directly: the server action sniffs
--     the bytes and writes the object. 1 MB cap + image-only mime allowlist
--     at the bucket level — the client re-encodes every photo to a 384 px
--     square (tens of KB), so the cap is defence in depth, not a working
--     limit.
--   * storage.objects policies — owner-scoped by the first path segment, the
--     same four as body-photos (00018).
--
-- WHO may have a photo is app policy, not SQL: the owner and every
-- beneficiary (adults AND children — the request covers "each member of the
-- family"); never the housekeeper, whose data the privacy policy keeps to a
-- name and a reading language.
--
-- PDPL: rows cascade from profiles; storage objects do NOT — eraseUserAccount()
-- removes the account's profile-photos folder explicitly and
-- removeFamilyMember() removes that member's objects by prefix.
-- /api/account/export attaches a 24h signed URL for each photo.
--
-- Idempotent (IF NOT EXISTS + guarded drops), additive; DELETE policy ships
-- day one. The app tolerates the pre-apply state (no photos are read; a save
-- fails with a plain message). Apply after 00027, then re-run
-- scripts/verify-migrations.sql (rows «00028 …»).
-- ============================================================================

create table if not exists public.profile_photos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_id text not null,
  path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, member_id)
);

comment on table public.profile_photos is
  'Profile photo per person: member_id "mom" (the owner) or a family_members.id. path is an object in the private profile-photos bucket (<user_id>/<member_id>-<uuid>.<ext>), served only through /api/profile-photo. Never the housekeeper.';

drop trigger if exists profile_photos_updated_at on public.profile_photos;
create trigger profile_photos_updated_at
  before update on public.profile_photos
  for each row execute function public.handle_updated_at();

alter table public.profile_photos enable row level security;

drop policy if exists "Users can read own profile photos" on public.profile_photos;
create policy "Users can read own profile photos"
  on public.profile_photos for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own profile photos" on public.profile_photos;
create policy "Users can insert own profile photos"
  on public.profile_photos for insert
  with check (auth.uid() = user_id);

-- Replacing a photo is an upsert (ON CONFLICT DO UPDATE), which needs UPDATE.
drop policy if exists "Users can update own profile photos" on public.profile_photos;
create policy "Users can update own profile photos"
  on public.profile_photos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own profile photos" on public.profile_photos;
create policy "Users can delete own profile photos"
  on public.profile_photos for delete
  using (auth.uid() = user_id);

-- ── private storage bucket ──────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  1048576, -- 1 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── owner-scoped storage policies ───────────────────────────────────────────
-- Path convention <user_id>/<file>: the first folder segment IS the owner.
drop policy if exists "Users read own profile photo files" on storage.objects;
create policy "Users read own profile photo files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users upload own profile photo files" on storage.objects;
create policy "Users upload own profile photo files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own profile photo files" on storage.objects;
create policy "Users update own profile photo files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own profile photo files" on storage.objects;
create policy "Users delete own profile photo files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
