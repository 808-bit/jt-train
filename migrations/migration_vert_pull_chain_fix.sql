-- Split mp_vert_pull: pull_ups -> ring_pull_ups becomes its own clean 2-step
-- chain. band_assisted_chin_ups (an assistance/regression variant, not a
-- progression step) is removed from the chain. ring_lsit_pullup (gated on
-- L-sit skill, not just pulling strength) moves to mp_core after l_sit.

-- Remove band_assisted_chin_ups from the visual chain (exercise + its
-- existing progression_rules row toward pull_ups stay intact)
DELETE FROM pattern_progressions WHERE pattern_id = 'mp_vert_pull' AND exercise_id = 'band_assisted_chin_ups';

-- Remove ring_lsit_pullup from mp_vert_pull (moving to mp_core below)
DELETE FROM pattern_progressions WHERE pattern_id = 'mp_vert_pull' AND exercise_id = 'ring_lsit_pullup';

-- Renumber: pull_ups=1, ring_pull_ups=2
UPDATE pattern_progressions SET level = 1 WHERE pattern_id = 'mp_vert_pull' AND exercise_id = 'pull_ups';
UPDATE pattern_progressions SET level = 2 WHERE pattern_id = 'mp_vert_pull' AND exercise_id = 'ring_pull_ups';

-- ring_pull_ups is now the ceiling of this 2-step chain
UPDATE progression_rules SET next_exercise_id = NULL WHERE exercise_id = 'ring_pull_ups';

-- Retag ring_lsit_pullup and add it to mp_core after l_sit
UPDATE exercises SET movement_pattern_id = 'mp_core' WHERE id = 'ring_lsit_pullup';
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment)
VALUES ('mp_core', 4, 'ring_lsit_pullup', 'L-Sit Pull-Up', 'dynamic', '3x6', 2, NULL, 'rings');

-- New rule: l_sit -> ring_lsit_pullup (requires rings + established pull-up strength)
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('l_sit', '3x15s', 2, 2, 'ring_lsit_pullup', NULL, 'rings', 'L-sit mastered — combine with pull-up strength (from the separate mp_vert_pull chain) for the L-sit pull-up');
