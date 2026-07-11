-- Overhead press and dips are both "vertical push" (force directed up, vs
-- horizontal push forward) — merge mp_overhead_press into mp_vert_push as a
-- second branch rather than keeping a separate pattern. All 5 exercises are
-- currently shoulder_safe=0 / "AVOID" given the impingement history, so this
-- branch is flagged inactive — structured now so it's ready once cleared,
-- rather than leaving an empty pattern with no chain.

UPDATE exercises SET movement_pattern_id = 'mp_vert_push'
WHERE id IN ('single_arm_kb_press', 'kb_push_press', 'kb_clean_and_press', 'kb_thruster', 'kb_armor_complex');

-- Overhead branch, levels 4-8 (existing dip track occupies 1-3)
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment)
VALUES
  ('mp_vert_push', 4, 'single_arm_kb_press', 'Single Arm KB Press', 'dynamic', '3x8', 2, NULL, 'kb'),
  ('mp_vert_push', 5, 'kb_push_press', 'KB Push Press', 'dynamic', '3x8', 2, NULL, 'kb'),
  ('mp_vert_push', 6, 'kb_clean_and_press', 'KB Clean and Press', 'dynamic', '3x6', 2, NULL, 'kb'),
  ('mp_vert_push', 7, 'kb_thruster', 'KB Thruster', 'dynamic', '3x8', 2, NULL, 'kb'),
  ('mp_vert_push', 8, 'kb_armor_complex', 'KB Armor Building Complex', 'dynamic', '3x2', 2, NULL, 'kb');

-- Rules for the overhead branch, all flagged as currently avoided
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
  ('single_arm_kb_press', '3x8', 2, 2, 'kb_push_press', NULL, NULL, 'AVOID — overhead press, right shoulder impingement risk. Do not select for programming until cleared.'),
  ('kb_push_press', '3x8', 2, 2, 'kb_clean_and_press', NULL, NULL, 'AVOID — overhead, right shoulder impingement risk. Do not select for programming until cleared.'),
  ('kb_clean_and_press', '3x6', 2, 2, 'kb_thruster', NULL, NULL, 'AVOID — overhead press, right shoulder impingement risk. Do not select for programming until cleared.'),
  ('kb_thruster', '3x8', 2, 2, 'kb_armor_complex', NULL, NULL, 'AVOID — overhead, right shoulder impingement risk. Do not select for programming until cleared.'),
  ('kb_armor_complex', '3x2', 2, 2, NULL, NULL, NULL, 'AVOID — overhead press component, right shoulder impingement risk. Ceiling of the branch; do not select for programming until cleared.');

-- mp_overhead_press no longer exists as a separate pattern
DELETE FROM movement_patterns WHERE id = 'mp_overhead_press';
