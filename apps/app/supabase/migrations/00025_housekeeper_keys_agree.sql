-- ─────────────────────────────────────────────────────────────────────────────
-- 00025 — the housekeeper is identified by TWO columns; make them agree.
--
-- `role = 'housekeeper'` is checked in ~40 places (the beneficiary count, the
-- plan roster, the translation trigger, the season roster, the export) and
-- `member_type = 'housekeeper'` in ~5. Nothing has ever enforced that the two
-- say the same thing, so a row where they disagree is read as a housekeeper by
-- some code and a beneficiary by the rest. The July audit closed the one
-- reachable path into that state (familyMemberInputSchema now rejects
-- `role: 'housekeeper'`, which was a tier-limit bypass) but left the dual key
-- itself standing — a latent split that only bites long after it is created.
--
-- Written to be SAFE TO APPLY: the repairs run first, so the constraint cannot
-- reject on existing data. Both directions are repaired because either column
-- could be the drifted one, and both statements are no-ops on a healthy table.
-- ─────────────────────────────────────────────────────────────────────────────

-- Repair: role says housekeeper, member_type does not.
update public.family_members
set member_type = 'housekeeper'
where role = 'housekeeper'
  and member_type is distinct from 'housekeeper';

-- Repair: member_type says housekeeper, role does not.
update public.family_members
set role = 'housekeeper'
where member_type = 'housekeeper'
  and role is distinct from 'housekeeper';

-- Now the invariant can be stated. `=` between two booleans is "both or
-- neither", which is exactly the rule: a row is a housekeeper in both columns
-- or in neither.
alter table public.family_members
  drop constraint if exists family_members_housekeeper_keys_agree;

alter table public.family_members
  add constraint family_members_housekeeper_keys_agree
  check ((role = 'housekeeper') = (member_type = 'housekeeper'));
