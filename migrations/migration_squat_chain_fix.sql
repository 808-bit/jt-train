-- Fix mp_anterior_squat progression chain:
-- 1. Remove racked_squat as a scripted progression step (exercise stays in the
--    library, just no longer part of the chain).
-- 2. Remove the cross-pattern redirect from double_kb_front_squat into the
--    hinge pattern (double_kb_deadlift) — the squat chain now stays within
--    the squat pattern: goblet -> double_kb_front_squat -> bulgarian_split ->
--    pistol_squat.

-- Remove racked_squat from the visual chain
DELETE FROM pattern_progressions WHERE pattern_id = 'mp_anterior_squat' AND exercise_id = 'racked_squat';

-- Renumber remaining levels: 1 goblet_squat (unchanged), 2 double_kb_front_squat,
-- 3 bulgarian_split_squat, 4 pistol_squat
UPDATE pattern_progressions SET level = 2 WHERE pattern_id = 'mp_anterior_squat' AND exercise_id = 'double_kb_front_squat';
UPDATE pattern_progressions SET level = 3 WHERE pattern_id = 'mp_anterior_squat' AND exercise_id = 'bulgarian_split_squat';
UPDATE pattern_progressions SET level = 4 WHERE pattern_id = 'mp_anterior_squat' AND exercise_id = 'pistol_squat';

-- goblet_squat no longer has racked_squat as an alt (removed from chain)
UPDATE progression_rules SET next_exercise_alt = NULL WHERE exercise_id = 'goblet_squat';

-- double_kb_front_squat now progresses within the squat pattern instead of
-- redirecting into the hinge pattern
UPDATE progression_rules
SET next_exercise_id = 'bulgarian_split_squat',
    notes = 'Bilateral double KB load ceiling — move to unilateral loading for continued difficulty'
WHERE exercise_id = 'double_kb_front_squat';

-- New rule to complete the chain: bulgarian_split_squat -> pistol_squat
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('bulgarian_split_squat', '3x8', 2, 2, 'pistol_squat', NULL, NULL, 'Unilateral loaded squat mastered — remove KB for full bodyweight single-leg ceiling');
