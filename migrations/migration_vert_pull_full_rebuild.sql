-- Rebuild mp_vert_pull as two independent, interchangeable tracks (bar vs
-- rings) per real progression curricula provided by the athlete. Not a
-- single ladder — either track can be trained on its own; they're not
-- sequential prerequisites of each other.

-- Clear the previous 2-step placeholder chain
DELETE FROM pattern_progressions WHERE pattern_id = 'mp_vert_pull';

-- New exercises: bar track
INSERT INTO exercises (id, display_name, category, equipment, movement_pattern, session_types, bilateral, home_available, shoulder_safe, notes, requires_pair, movement_pattern_id, matrix_level, modality, bw_load_factor, logging_mode) VALUES
('wide_grip_pull_up', 'Wide-Grip Pull-Up', 'Pull', 'BW', 'pull', 'Upper;Full Body A;Full Body B', 1, 1, 1, 'Hands at 1.5x shoulder width — targets outer lats', 0, 'mp_vert_pull', 2, 'calisthenics', 1, 'standard'),
('weighted_pull_up', 'Weighted Pull-Up', 'Pull', 'BW', 'pull', 'Upper;Full Body A;Full Body B', 1, 1, 1, 'Add 5-10kg via dip belt', 0, 'mp_vert_pull', 3, 'calisthenics', 1, 'standard'),
('l_sit_pull_up_bar', 'L-Sit Pull-Up (Bar)', 'Pull', 'BW', 'pull', 'Upper;Full Body A;Full Body B', 1, 1, 1, 'Legs held straight out in an L throughout the pull', 0, 'mp_vert_pull', 3, 'calisthenics', 1, 'standard'),
('side_to_side_pullup', 'Side-to-Side Pull-Up', 'Pull', 'BW', 'pull', 'Upper;Full Body A;Full Body B', 0, 1, 1, 'Wide grip, guide chest to alternating hand at the top of each rep', 0, 'mp_vert_pull', 4, 'calisthenics', 1, 'standard'),
('archer_negative_pullup', 'Archer Negative Pull-Up', 'Pull', 'BW', 'pull', 'Upper;Full Body A;Full Body B', 0, 1, 1, 'Pull up normally with wide grip, extend one arm fully straight along the bar, lower as slowly as possible on the bent arm only', 0, 'mp_vert_pull', 4, 'calisthenics', 1, 'standard'),
('archer_pullup_bar', 'Archer Pull-Up (Bar)', 'Pull', 'BW', 'pull', 'Upper;Full Body A;Full Body B', 0, 1, 1, 'Extra-wide grip, pull chest to one hand while the other arm stays locked straight on the bar — alternate sides', 0, 'mp_vert_pull', 5, 'calisthenics', 1, 'standard'),
('typewriter_pullup_bar', 'Typewriter Pull-Up (Bar)', 'Pull', 'BW', 'pull', 'Upper;Full Body A;Full Body B', 0, 1, 1, 'Pull to center, chin above bar, slide the whole body across to one hand then the other without dropping, then lower', 0, 'mp_vert_pull', 6, 'calisthenics', 1, 'standard');

-- New exercises: rings track
INSERT INTO exercises (id, display_name, category, equipment, movement_pattern, session_types, bilateral, home_available, shoulder_safe, notes, requires_pair, movement_pattern_id, matrix_level, modality, bw_load_factor, logging_mode) VALUES
('offset_ring_pullup', 'Offset Ring Pull-Up', 'Pull', 'Rings', 'pull', 'Upper;Full Body A;Full Body B;Rings Only', 0, 1, 1, 'One ring set noticeably higher than the other — lower arm does most of the work, alternate which side is higher each set', 0, 'mp_vert_pull', 4, 'calisthenics', 1, 'standard'),
('ring_archer_lockoff', 'Ring Archer Lockoff / Negative', 'Pull', 'Rings', 'pull', 'Upper;Full Body A;Full Body B;Rings Only', 0, 1, 1, 'Hang from high rings, pull straight up to the top lockoff position, hold, then lower under control', 0, 'mp_vert_pull', 5, 'calisthenics', 1, 'standard'),
('full_ring_archer_pullup', 'Full Ring Archer Pull-Up', 'Pull', 'Rings', 'pull', 'Upper;Full Body A;Full Body B;Rings Only', 0, 1, 1, 'From a dead hang, pull toward one ring while driving the other ring straight out to the side, tucked hard against chest at the top — control the descent', 0, 'mp_vert_pull', 5, 'calisthenics', 1, 'standard'),
('ring_typewriter_pullup', 'Ring Typewriter Pull-Up', 'Pull', 'Rings', 'pull', 'Upper;Full Body A;Full Body B;Rings Only', 0, 1, 1, 'Pull up until chest is level with both rings, slide horizontally across to one ring by pushing the other straight out, then slide back across without dropping', 0, 'mp_vert_pull', 6, 'calisthenics', 1, 'standard');

-- Bar track chain, levels 1-7
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment) VALUES
('mp_vert_pull', 1, 'pull_ups', 'Standard Strict Pull-Up', 'dynamic', '3x10-12', 2, NULL, NULL),
('mp_vert_pull', 2, 'wide_grip_pull_up', 'Wide-Grip Pull-Up', 'dynamic', '3x8', 2, NULL, NULL),
('mp_vert_pull', 3, 'weighted_pull_up', 'Weighted Pull-Up', 'dynamic', '3x8', 2, NULL, NULL),
('mp_vert_pull', 3, 'l_sit_pull_up_bar', 'L-Sit Pull-Up (Bar)', 'dynamic', '3x6', 2, NULL, NULL),
('mp_vert_pull', 4, 'side_to_side_pullup', 'Side-to-Side Pull-Up', 'dynamic', '3x6', 2, NULL, NULL),
('mp_vert_pull', 5, 'archer_negative_pullup', 'Archer Negative', 'dynamic', '3x4', 2, NULL, NULL),
('mp_vert_pull', 6, 'archer_pullup_bar', 'The Archer Pull-Up', 'dynamic', '3x4', 2, NULL, NULL),
('mp_vert_pull', 7, 'typewriter_pullup_bar', 'The Typewriter Pull-Up', 'dynamic', '3x2', 2, NULL, NULL);

-- Rings track chain, levels 8-12 (separate track, same pattern)
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment) VALUES
('mp_vert_pull', 8, 'ring_pull_ups', 'Standard Ring Pull-Up (Neutral Grip Rotation)', 'dynamic', '3x8-10', 2, NULL, 'rings'),
('mp_vert_pull', 9, 'offset_ring_pullup', 'Offset Ring Pull-Up', 'dynamic', '3x8', 2, NULL, 'rings'),
('mp_vert_pull', 10, 'ring_archer_lockoff', 'Ring Archer Lockoff & Negatives', 'dynamic', '3x4', 2, NULL, 'rings'),
('mp_vert_pull', 11, 'full_ring_archer_pullup', 'Full Ring Archer Pull-Up', 'dynamic', '3x4', 2, NULL, 'rings'),
('mp_vert_pull', 12, 'ring_typewriter_pullup', 'Ring Typewriter Pull-Up', 'dynamic', '3x2', 2, NULL, 'rings');

-- Bar track rules
UPDATE progression_rules SET next_exercise_id = 'wide_grip_pull_up', notes = 'Master 10-12 clean strict reps before adding grip/loading variations' WHERE exercise_id = 'pull_ups';

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('wide_grip_pull_up', '3x8', 2, 2, 'weighted_pull_up', 'l_sit_pull_up_bar', NULL, 'Outer lat strength built — either add external load or hold an L-sit through the pull, both are valid next steps'),
('weighted_pull_up', '3x8', 2, 2, 'side_to_side_pullup', NULL, NULL, 'Loaded/L-sit pulling strength established — begin lateral loading work'),
('l_sit_pull_up_bar', '3x6', 2, 2, 'side_to_side_pullup', NULL, NULL, 'Loaded/L-sit pulling strength established — begin lateral loading work'),
('side_to_side_pullup', '3x6', 2, 2, 'archer_negative_pullup', NULL, NULL, 'Lateral weight shift under control — isolate one arm with a slow negative'),
('archer_negative_pullup', '3x4', 2, 2, 'archer_pullup_bar', NULL, NULL, 'Eccentric control on one arm mastered — attempt the full concentric archer pull-up'),
('archer_pullup_bar', '3x4', 2, 2, 'typewriter_pullup_bar', NULL, NULL, 'Archer pull-up mastered both sides — combine into continuous side-to-side tension for the typewriter'),
('typewriter_pullup_bar', '3x2', 2, 2, NULL, NULL, NULL, 'Ceiling of the bar track — hardest unilateral bar pull skill');

-- Rings track rules
UPDATE progression_rules SET next_exercise_id = 'offset_ring_pullup', notes = 'Neutral grip rotation mastered for 8-10 reps' WHERE exercise_id = 'ring_pull_ups';

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('offset_ring_pullup', '3x8', 2, 2, 'ring_archer_lockoff', NULL, 'rings', 'Uneven loading tolerated well on both sides. Archer Ring Rows (archer_ring_row, in the horizontal pull chain) are recommended cross-training here — same unilateral motor pattern in the horizontal plane with less bodyweight involved.'),
('ring_archer_lockoff', '3x4', 2, 2, 'full_ring_archer_pullup', NULL, 'rings', 'Top-position control established — attempt the full dynamic archer pull'),
('full_ring_archer_pullup', '3x4', 2, 2, 'ring_typewriter_pullup', NULL, 'rings', 'Full archer pull-up mastered both sides — combine into continuous lateral tension'),
('ring_typewriter_pullup', '3x2', 2, 2, NULL, NULL, 'rings', 'Ceiling of the rings track — hardest unilateral ring pull skill');

-- Band-assisted rings pull-up feeds into ring_pull_ups (standalone regression, not in tree — same treatment as band_assisted_chin_ups -> pull_ups)
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('band_assisted_ring_pull_ups', '3x8', 2, 2, 'ring_pull_ups', NULL, 'rings', 'Remove band assistance progressively');
