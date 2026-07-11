-- airborne_squat and ring_assisted_pistol are assisted variants toward
-- pistol_squat, not required steps — standalone regression rules only.
-- kb_squat is a leftover duplicate of goblet_squat, left untouched/unused.
-- Lunge family gets its own parallel track under mp_anterior_squat.

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('airborne_squat', '3x8', 2, 2, 'pistol_squat', NULL, NULL, 'Bridge exercise — back knee grazes floor, no equipment. Once comfortable, attempt full pistol squat.'),
('ring_assisted_pistol', '3x8', 2, 2, 'pistol_squat', NULL, 'rings', 'Ring assistance for balance only — remove assistance progressively toward unassisted pistol squat.');

-- Lunge track, levels 5-8
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment) VALUES
('mp_anterior_squat', 5, 'kb_goblet_reverse_lunge', 'KB Goblet Reverse Lunge', 'dynamic', '3x10', 2, NULL, NULL),
('mp_anterior_squat', 6, 'walking_lunges_kb', 'KB Walking Lunges', 'dynamic', '3x10', 2, NULL, NULL),
('mp_anterior_squat', 7, 'kb_lateral_lunge', 'KB Lateral Lunge', 'dynamic', '3x8', 2, NULL, NULL),
('mp_anterior_squat', 8, 'cossack_squat', 'Cossack Squat', 'dynamic', '3x8', 2, NULL, NULL);

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('kb_goblet_reverse_lunge', '3x10', 2, 2, 'walking_lunges_kb', NULL, NULL, 'Static reverse lunge mastered — add continuous forward movement'),
('walking_lunges_kb', '3x10', 2, 2, 'kb_lateral_lunge', NULL, NULL, 'Sagittal-plane lunging mastered — add the frontal-plane (lateral) demand'),
('kb_lateral_lunge', '3x8', 2, 2, 'cossack_squat', NULL, NULL, 'Lateral lunge mastered — increase depth and ankle/hip mobility demand'),
('cossack_squat', '3x8', 2, 2, NULL, NULL, NULL, 'Ceiling of the lunge track — deepest lateral squat pattern');
