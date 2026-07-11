-- JT.TRAIN — Exercise variety fix: rings home_available bug + pattern-taxonomy cleanup
-- Run: wrangler d1 execute jt-train-db --file=migrations/migration_exercise_variety_fix.sql --remote
--
-- Context: every Rings-equipment exercise (22 rows) was seeded with
-- home_available=0, so the entire ring-based progression trees for
-- horizontal pull, vertical pull, vertical push, and core were invisible
-- to the coach at Home — even though rings are the primary home kit item
-- (location_config.Home has rings:true). This forced the coach to keep
-- reusing the same small non-ring pool (pull-ups, push-ups, KB) for those
-- patterns. Also cleans up dead/duplicate movement-pattern data found
-- during the same review.

-- ── 1. Rings home_available fix ──────────────────────────────────────────────
UPDATE exercises SET home_available = 1
WHERE equipment LIKE '%Rings%' AND home_available = 0;

-- ── 2. Drop orphan pattern_progressions rows ─────────────────────────────────
-- These 7 rungs reference exercise_ids that were never created in the
-- exercises table — dead links in the TREE tab, not loggable, not
-- reachable by the coach. Removing rather than inventing new prescribed
-- exercises on the athlete's behalf.
DELETE FROM pattern_progressions WHERE exercise_id IN (
  'archer_ring_pull_up',
  'hanging_l_sit',
  'kb_overhead_carry',
  'kb_rack_carry',
  'knee_push_ups',
  'weighted_parallette_dips',
  'weighted_pull_ups'
);

-- ── 3. Consolidate duplicate movement_patterns taxonomy ──────────────────────
-- Two separate migrations each inserted a full pattern taxonomy into the
-- same movement_patterns table: unprefixed ids (horiz_push, vert_push,
-- horiz_pull, vert_pull, hinge, squat, core_comp, carry) used only by
-- pattern_progressions, and mp_-prefixed ids (mp_horiz_push, ...) used by
-- exercises.movement_pattern_id / progression_rules. Same concepts, two
-- unrelated rows. Repoint pattern_progressions at the mp_ ids and drop the
-- legacy duplicates so there's one taxonomy.
UPDATE pattern_progressions SET pattern_id = 'mp_horiz_push'      WHERE pattern_id = 'horiz_push';
UPDATE pattern_progressions SET pattern_id = 'mp_vert_push'       WHERE pattern_id = 'vert_push';
UPDATE pattern_progressions SET pattern_id = 'mp_horiz_pull'      WHERE pattern_id = 'horiz_pull';
UPDATE pattern_progressions SET pattern_id = 'mp_vert_pull'       WHERE pattern_id = 'vert_pull';
UPDATE pattern_progressions SET pattern_id = 'mp_posterior_hinge' WHERE pattern_id = 'hinge';
UPDATE pattern_progressions SET pattern_id = 'mp_anterior_squat'  WHERE pattern_id = 'squat';
UPDATE pattern_progressions SET pattern_id = 'mp_core'            WHERE pattern_id = 'core_comp';
UPDATE pattern_progressions SET pattern_id = 'mp_carry'           WHERE pattern_id = 'carry';

DELETE FROM movement_patterns WHERE id IN (
  'horiz_push', 'vert_push', 'horiz_pull', 'vert_pull',
  'hinge', 'squat', 'core_comp', 'carry'
);
