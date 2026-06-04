-- JT.TRAIN — Progression tree schema
-- Run: wrangler d1 execute jt-train-db --file=migration_progression.sql --remote

-- ── Progression rules ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progression_rules (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id         TEXT NOT NULL REFERENCES exercises(id),
  rep_target          TEXT NOT NULL,    -- e.g. '3x10' — when this is hit consistently, progress
  rir_target          INTEGER DEFAULT 2, -- RIR threshold to confirm readiness
  sessions_to_confirm INTEGER DEFAULT 2, -- consecutive sessions hitting target before progressing
  intensity_levers    TEXT,              -- JSON array of things to try before tier jump
  next_exercise_id    TEXT,              -- default next exercise (equipment permitting)
  next_exercise_alt   TEXT,              -- fallback if next requires unavailable equipment
  next_requires       TEXT,              -- equipment needed for next_exercise_id e.g. 'rings'
  notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_prog_exercise ON progression_rules(exercise_id);

-- ── Seed progression rules ────────────────────────────────────────────────────

-- PULL PATTERN ─────────────────────────────────────────────────────────────────
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('ring_rows', '3x12', 2, 2,
 '["Steepen angle (harder)", "2s pause at chest", "4-0-1-0 tempo", "Feet elevated"]',
 'deep_ring_rows', NULL, 'rings',
 'Angle-based progression — horizontal = advanced');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('deep_ring_rows', '3x10', 2, 2,
 '["Near-horizontal angle", "2s pause at top", "False grip", "Slow eccentric 4s"]',
 'false_grip_ring_rows', NULL, 'rings',
 'Transition exercise toward muscle-up');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('false_grip_ring_rows', '3x10', 2, 2,
 '["Horizontal body position", "Hold false grip throughout", "Slow eccentric 4s"]',
 'ring_pull_ups', 'pull_ups', 'rings',
 'False grip is prerequisite for muscle-up');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('band_assisted_chin_ups', '3x8', 2, 2,
 '["Lighter band", "Slower eccentric", "Pause at top"]',
 'pull_ups', NULL, NULL,
 'Remove band assistance progressively');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('pull_ups', '3x10', 2, 2,
 '["Slow eccentric 4s", "Pause at top", "L-sit position", "Narrow grip"]',
 'ring_pull_ups', NULL, 'rings',
 'Bodyweight ceiling — move to rings or add load');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('ring_pull_ups', '3x10', 2, 2,
 '["Slow eccentric 4s", "L-sit position", "False grip", "Pause at top"]',
 'ring_lsit_pullup', NULL, 'rings',
 'Ring instability mastered');

-- PUSH PATTERN ─────────────────────────────────────────────────────────────────
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('push_ups', '3x20', 2, 2,
 '["Slow eccentric 4s", "Pause at bottom", "Wider hand position", "Diamond push-ups"]',
 'parallette_pushups', NULL, 'parallettes',
 'Rep ceiling before adding difficulty');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('parallette_pushups', '3x15', 2, 2,
 '["4-0-2-0 tempo", "Deeper ROM below handles", "Narrow grip", "Feet elevated"]',
 'neutral_grip_parallette_pushups', NULL, 'parallettes',
 'ROM advantage over floor push-ups');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('neutral_grip_parallette_pushups', '3x15', 2, 2,
 '["4-0-2-0 tempo", "Deep deficit ROM", "Feet elevated", "Weighted vest"]',
 'ring_pushups', 'parallette_dips', 'rings',
 'Neutral grip reduces shoulder stress');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('ring_pushups', '3x12', 2, 2,
 '["Lower rings (harder)", "RTO at top", "Slow eccentric", "Feet elevated"]',
 'rto_ring_pushup', NULL, 'rings',
 'Ring instability is the load');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('parallette_dips', '3x12', 2, 2,
 '["4-0-2-0 tempo", "Full ROM below handles", "Pause at bottom", "Lean forward for chest"]',
 'ring_dips', NULL, 'rings',
 'No weight belt needed — tempo and ROM are the levers');

-- SQUAT/HINGE PATTERN ──────────────────────────────────────────────────────────
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('goblet_squat', '3x12', 2, 2,
 '["Heavier KB", "3-0-2-0 tempo", "Pause at bottom 2s", "Cossack squat"]',
 'double_kb_front_squat', 'racked_squat', NULL,
 'Single bell ceiling — move to double');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('double_kb_front_squat', '4x8', 2, 2,
 '["Heavier bells", "3-0-2-0 tempo", "Pause at bottom", "Increase asymmetric load"]',
 'double_kb_deadlift', NULL, NULL,
 'Heaviest double KB squat pattern available');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('kb_deadlift', '3x10', 2, 2,
 '["Heavier KB", "3-2-1-0 tempo", "Pause at floor", "Single leg variation"]',
 'double_kb_deadlift', 'kb_suitcase_rdl', NULL,
 'Single bell to double progression');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('kb_suitcase_rdl', '3x10', 2, 2,
 '["Heavier KB", "3-2-1-0 tempo", "2s pause at bottom", "Deficit from step"]',
 'single_leg_kb_rdl', NULL, NULL,
 'Lateral stability → single leg demand');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('kb_floor_press', '3x10', 2, 2,
 '["Heavier KB", "4-0-1-0 tempo", "2s pause at chest", "Increase load per arm"]',
 NULL, NULL, NULL,
 'Floor press ceiling — shoulder safe max. No overhead progression given impingement history.');

-- CORE PATTERN ─────────────────────────────────────────────────────────────────
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('support_hold', '3x20s', 2, 2,
 '["Longer hold", "Protraction cue", "Scapular depression", "Add L-sit tuck"]',
 'parallette_l_sit', NULL, 'parallettes',
 'Foundation for L-sit progression');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('parallette_l_sit', '3x10s', 2, 2,
 '["Longer holds", "Full leg extension", "Multiple holds with short rest"]',
 'l_sit', NULL, 'parallettes',
 'Tuck → full extension progression');
