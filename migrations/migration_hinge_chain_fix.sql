-- Fix mp_posterior_hinge:
-- 1. kb_deadlift should progress in-order to kb_suitcase_rdl (matches the
--    visual chain), with double_kb_deadlift demoted to an alternative move
--    rather than the primary skip-ahead next step.
-- 2. Split kb_swing / double_kb_swing out into a new "Power / Conditioning"
--    pattern — they're a strength-to-power pivot, not a heavier deadlift
--    variant, so they don't belong in the same linear hinge-strength chain.

UPDATE progression_rules
SET next_exercise_id = 'kb_suitcase_rdl',
    next_exercise_alt = 'double_kb_deadlift',
    notes = 'Single bell to double progression — double_kb_deadlift available as an alternative if suitcase RDL is undertrained'
WHERE exercise_id = 'kb_deadlift';

-- Complete the remaining in-pattern chain: single_leg_kb_rdl -> double_kb_deadlift
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('single_leg_kb_rdl', '3x8', 2, 2, 'double_kb_deadlift', NULL, NULL, 'Unilateral stability mastered — move to heaviest bilateral hinge load');

-- double_kb_deadlift is now the ceiling of mp_posterior_hinge (swings moved out)
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('double_kb_deadlift', '3x8', 2, 2, NULL, NULL, NULL, 'Heaviest bilateral hinge load — ceiling for this pattern. Power/conditioning work (swings) lives in mp_power_conditioning, not a hinge-strength progression.');

-- New movement pattern for power/conditioning work
INSERT INTO movement_patterns (id, name, description, focus, display_order)
VALUES ('mp_power_conditioning', 'Power / Conditioning', 'Ballistic hip-hinge power output — distinct from hinge strength work', 'power', 11);

-- Retag the two swing exercises
UPDATE exercises SET movement_pattern_id = 'mp_power_conditioning' WHERE id IN ('kb_swing', 'double_kb_swing');

-- Move their pattern_progressions rows into the new pattern, levels 1-2
UPDATE pattern_progressions SET pattern_id = 'mp_power_conditioning', level = 1 WHERE pattern_id = 'mp_posterior_hinge' AND exercise_id = 'kb_swing';
UPDATE pattern_progressions SET pattern_id = 'mp_power_conditioning', level = 2 WHERE pattern_id = 'mp_posterior_hinge' AND exercise_id = 'double_kb_swing';

-- Progression rule within the new track
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('kb_swing', '3x15', 2, 2, 'double_kb_swing', NULL, NULL, 'Single bell ballistic power mastered — move to double for higher power output');
