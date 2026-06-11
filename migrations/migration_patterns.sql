-- JT.TRAIN — Movement pattern taxonomy
-- Run: wrangler d1 execute jt-train-db --file=migration_patterns.sql --remote

-- movement_patterns table already exists, just insert new patterns
INSERT OR IGNORE INTO movement_patterns (id, name, display_order) VALUES ('horiz_push', 'Horizontal Push',      1);
INSERT OR IGNORE INTO movement_patterns (id, name, display_order) VALUES ('vert_push',  'Vertical Push (Dips)', 2);
INSERT OR IGNORE INTO movement_patterns (id, name, display_order) VALUES ('horiz_pull', 'Horizontal Pull',      3);
INSERT OR IGNORE INTO movement_patterns (id, name, display_order) VALUES ('vert_pull',  'Vertical Pull',        4);
INSERT OR IGNORE INTO movement_patterns (id, name, display_order) VALUES ('hinge',      'Hinge',                5);
INSERT OR IGNORE INTO movement_patterns (id, name, display_order) VALUES ('squat',      'Squat',                6);
INSERT OR IGNORE INTO movement_patterns (id, name, display_order) VALUES ('core_comp',  'Core (Compression)',   7);
INSERT OR IGNORE INTO movement_patterns (id, name, display_order) VALUES ('carry',      'Carry',                8);

-- pattern_progressions table
CREATE TABLE IF NOT EXISTS pattern_progressions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_id      TEXT NOT NULL,
  level           INTEGER NOT NULL,
  exercise_id     TEXT NOT NULL,
  exercise_name   TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'dynamic',
  duration_target TEXT,
  rep_target      TEXT,
  rir_target      INTEGER DEFAULT 2,
  notes           TEXT,
  equipment       TEXT
);

CREATE INDEX IF NOT EXISTS idx_pp_pattern  ON pattern_progressions(pattern_id, level);
CREATE INDEX IF NOT EXISTS idx_pp_exercise ON pattern_progressions(exercise_id);

-- Horizontal Push
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('horiz_push', 1, 'knee_push_ups',      'Knee Push-Up',         'dynamic', '3x15', 2, 'Foundation — build volume before progressing', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('horiz_push', 2, 'push_ups',           'Standard Push-Up',     'dynamic', '3x20', 2, 'Full body plank, scapular control', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('horiz_push', 3, 'parallette_pushups', 'Parallette Push-Up',   'dynamic', '3x15', 2, 'Deeper ROM below handles', 'parallettes_low');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('horiz_push', 4, 'ring_pushups',       'Ring Push-Up',         'dynamic', '3x12', 2, 'Ring instability is the load', 'rings');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('horiz_push', 5, 'rto_ring_pushup',    'RTO / Archer Push-Up', 'dynamic', '3x8',  2, 'Rings turned out at top, extreme stability demand', 'rings');

-- Vertical Push (Dips)
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, duration_target, rep_target, rir_target, notes, equipment) VALUES ('vert_push', 1, 'support_hold',             'Parallette Support Hold', 'isometric', '3x30s', null, 2, 'Shoulder depression and protraction', 'parallettes_high');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, duration_target, rep_target, rir_target, notes, equipment) VALUES ('vert_push', 2, 'parallette_dips',          'Parallette Dip',          'dynamic',   null,    '3x12', 2, 'Full ROM, slight forward lean for chest', 'parallettes_high');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, duration_target, rep_target, rir_target, notes, equipment) VALUES ('vert_push', 3, 'ring_dips',                'Ring Dip',                'dynamic',   null,    '3x10', 2, 'Ring instability greatly increases demand', 'rings');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, duration_target, rep_target, rir_target, notes, equipment) VALUES ('vert_push', 4, 'weighted_parallette_dips', 'Weighted Dip',            'weighted',  null,    '3x8',  2, 'Requires weight belt or vest', 'parallettes_high');

-- Horizontal Pull
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('horiz_pull', 1, 'ring_rows',            'Ring Row (45°)',       'dynamic', '3x12', 2, 'Feet flat, body ~45° to floor', 'rings');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('horiz_pull', 2, 'ring_rows',            'Ring Row (low angle)', 'dynamic', '3x10', 2, 'Body near horizontal, feet elevated', 'rings');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('horiz_pull', 3, 'deep_ring_rows',       'Deep Ring Row',        'dynamic', '3x10', 2, 'Full scapular retraction, horizontal body', 'rings');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('horiz_pull', 4, 'false_grip_ring_rows', 'False Grip Ring Row',  'dynamic', '3x10', 2, 'False grip prerequisite for muscle-up', 'rings');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('horiz_pull', 5, 'archer_ring_row',      'Archer Ring Row',      'dynamic', '3x8',  2, 'Single arm loading via archer position', 'rings');

-- Vertical Pull
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('vert_pull', 1, 'band_assisted_chin_ups', 'Band Assisted Pull-Up', 'dynamic', '3x8',  2, 'Light band, full ROM, slow eccentric', 'pull_up_bar');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('vert_pull', 2, 'pull_ups',               'Pull-Up',               'dynamic', '3x10', 2, 'Dead hang start, chin over bar', 'pull_up_bar');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('vert_pull', 3, 'ring_pull_ups',          'Ring Pull-Up',          'dynamic', '3x10', 2, 'Ring instability challenges shoulder stability', 'rings');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('vert_pull', 4, 'archer_ring_pull_up',    'Archer Pull-Up',        'dynamic', '3x6',  2, 'Straight arm on one side, archer position', 'rings');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('vert_pull', 5, 'ring_lsit_pullup',       'L-Sit Pull-Up',         'dynamic', '3x6',  2, 'L-sit position maintained throughout', 'rings');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('vert_pull', 6, 'weighted_pull_ups',      'Weighted Pull-Up',      'weighted','3x8',  2, 'Add load via belt or vest', 'pull_up_bar');

-- Hinge
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('hinge', 1, 'kb_deadlift',        'KB Deadlift (single)', 'dynamic', '3x10', 2, 'Hip hinge pattern, neutral spine', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('hinge', 2, 'kb_suitcase_rdl',    'KB Suitcase RDL',      'dynamic', '3x10', 2, 'Lateral stability, anti-lateral-flexion', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('hinge', 3, 'single_leg_kb_rdl',  'Single Leg KB RDL',    'dynamic', '3x8',  2, 'Unilateral hinge, hip stability', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('hinge', 4, 'double_kb_deadlift', 'Double KB Deadlift',   'dynamic', '3x8',  2, 'Bilateral loaded hinge, heavy', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('hinge', 5, 'kb_swing',           'KB Swing (single)',    'dynamic', '3x15', 2, 'Hip drive power expression', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('hinge', 6, 'double_kb_swing',    'Double KB Swing',      'dynamic', '3x15', 2, 'Max hip drive, bilateral power', null);

-- Squat
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('squat', 1, 'goblet_squat',          'Goblet Squat',          'dynamic', '3x12', 2, 'Counter-balance, upright torso', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('squat', 2, 'racked_squat',          'Racked Squat',          'dynamic', '3x10', 2, 'Single KB rack, heavier than goblet', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('squat', 3, 'double_kb_front_squat', 'Double KB Front Squat', 'dynamic', '3x8',  2, 'Bilateral rack, maximum KB squat load', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('squat', 4, 'bulgarian_split_squat', 'Bulgarian Split Squat', 'dynamic', '3x8',  2, 'Rear foot elevated, unilateral demand', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('squat', 5, 'pistol_squat',          'Pistol Squat',          'dynamic', '3x5',  2, 'Full single leg squat, advanced skill', null);

-- Core (Compression)
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, duration_target, rep_target, rir_target, notes, equipment) VALUES ('core_comp', 1, 'support_hold',     'Parallette Support Hold', 'isometric', '3x20s', null, 2, 'Shoulder depression, scapular retraction', 'parallettes_high');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, duration_target, rep_target, rir_target, notes, equipment) VALUES ('core_comp', 2, 'parallette_l_sit', 'Tuck L-Sit',              'isometric', '3x10s', null, 2, 'Knees tucked, hips above hands', 'parallettes_high');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, duration_target, rep_target, rir_target, notes, equipment) VALUES ('core_comp', 3, 'l_sit',            'L-Sit (Parallettes)',     'isometric', '3x15s', null, 2, 'Legs fully extended', 'parallettes_high');
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, duration_target, rep_target, rir_target, notes, equipment) VALUES ('core_comp', 4, 'hanging_l_sit',    'Hanging L-Sit',           'isometric', '3x10s', null, 2, 'Bar or rings, full compression', 'pull_up_bar');

-- Carry
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('carry', 1, 'kb_farmers_carry',  'KB Farmers Carry',  'dynamic', '3x30m', 2, 'Bilateral loaded carry, grip and posture', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('carry', 2, 'kb_suitcase_carry', 'KB Suitcase Carry', 'dynamic', '3x20m', 2, 'Unilateral, anti-lateral-flexion', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('carry', 3, 'kb_rack_carry',     'KB Rack Carry',     'dynamic', '3x20m', 2, 'Single KB racked, thoracic stability', null);
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, notes, equipment) VALUES ('carry', 4, 'kb_overhead_carry', 'KB Overhead Carry', 'dynamic', '3x15m', 2, 'Shoulder stability, overhead lockout', null);
