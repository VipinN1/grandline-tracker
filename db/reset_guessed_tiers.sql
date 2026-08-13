-- One-time corrective migration — run once in the Supabase SQL editor.
--
-- The original backfill in tournament_tier.sql guessed `tier` from
-- player_count (>=25 players -> 'regional', >=100 -> 'major') for every row
-- that existed before the tier column did. That guess was wrong often enough
-- to be a problem — a well-attended Locals event (25+ players) got tagged
-- Regional, and shows up in the Trophy Cabinet's Regionals/Majors case
-- incorrectly.
--
-- Per-request: reset every tournament back to the 'locals' default so the
-- data starts clean, and let people re-tag genuine Regional/Major/Pre-Release
-- results by hand via Log Result's Event Tier picker.
--
-- Excludes is_legacy rows (added via "+ Add Past Result" on the Trophy
-- Cabinet) since those tiers were hand-picked at entry time, not guessed —
-- they're also constrained to regional/major only, so resetting them to
-- locals isn't meaningful.
--
-- NOTE: this is a blunt reset. It also reverts any tournament someone
-- correctly and deliberately tagged Regional/Major/Pre-Release before now —
-- those will need to be re-tagged by hand afterward too. Run only once.
update public.tournaments
set tier = 'locals'
where is_legacy = false
  and tier <> 'locals';
