-- JT.TRAIN — Moat schema: outcome labeling + normative benchmarks
-- Run: wrangler d1 execute jt-train-db --file=migration_moat.sql --remote

-- ── 1. Outcome label on debriefs ─────────────────────────────────────────────
-- Values: 'progressed' | 'maintained' | 'declined' | 'incomplete'
ALTER TABLE debriefs ADD COLUMN outcome TEXT;

-- ── 2. Normative benchmarks ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS benchmarks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id     TEXT NOT NULL REFERENCES exercises(id),
  level           TEXT NOT NULL,    -- 'beginner' | 'intermediate' | 'advanced'
  metric_type     TEXT NOT NULL,    -- 'weight_kg' | 'angle_deg' | 'progression_tier'
  metric_value    REAL,             -- numeric value where applicable
  reps            TEXT,             -- e.g. '8-10'
  rir_target      INTEGER,          -- RIR at this benchmark
  notes           TEXT,
  source          TEXT DEFAULT 'estimated', -- 'estimated' | 'empirical'
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_exercise ON benchmarks(exercise_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_level    ON benchmarks(level);

-- ── 3. Seed benchmarks for 15 key exercises ───────────────────────────────────
-- KB Deadlift
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('kb_deadlift', 'beginner',     'weight_kg', 24,  '8-10', 2, 'Hinge pattern established, form clean'),
  ('kb_deadlift', 'intermediate', 'weight_kg', 48,  '8-10', 2, 'Full hip extension, neutral spine maintained'),
  ('kb_deadlift', 'advanced',     'weight_kg', 72,  '8-10', 2, 'Loaded hinge under fatigue, consistent tempo');

-- Double KB Deadlift
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('double_kb_deadlift', 'beginner',     'weight_kg', 40,  '8',    2, 'Two bell coordination, symmetric load'),
  ('double_kb_deadlift', 'intermediate', 'weight_kg', 64,  '8',    2, 'Current range: 44-52kg'),
  ('double_kb_deadlift', 'advanced',     'weight_kg', 88,  '8',    2, 'Elite KB strength threshold');

-- Double KB Front Squat
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('double_kb_front_squat', 'beginner',     'weight_kg', 32,  '8',    2, 'Rack position stable, depth consistent'),
  ('double_kb_front_squat', 'intermediate', 'weight_kg', 52,  '8',    2, 'Current range: 44kg'),
  ('double_kb_front_squat', 'advanced',     'weight_kg', 72,  '8',    2, 'Heavy asymmetric rack, full depth');

-- Goblet Squat
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('goblet_squat', 'beginner',     'weight_kg', 16,  '10',   2, 'Pattern established'),
  ('goblet_squat', 'intermediate', 'weight_kg', 32,  '10',   2, 'Current range'),
  ('goblet_squat', 'advanced',     'weight_kg', 48,  '10',   2, 'Single bell heavy goblet');

-- KB Suitcase RDL
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('kb_suitcase_rdl', 'beginner',     'weight_kg', 16,  '8',    2, 'Lateral stability present'),
  ('kb_suitcase_rdl', 'intermediate', 'weight_kg', 28,  '8',    2, 'Current range: 24kg'),
  ('kb_suitcase_rdl', 'advanced',     'weight_kg', 40,  '8',    2, 'Heavy unilateral hinge');

-- KB Floor Press
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('kb_floor_press', 'beginner',     'weight_kg', 16,  '8-10', 2, 'Per arm, corkscrew technique'),
  ('kb_floor_press', 'intermediate', 'weight_kg', 24,  '8-10', 2, 'Current range'),
  ('kb_floor_press', 'advanced',     'weight_kg', 36,  '8-10', 2, 'Heavy floor press per arm');

-- Ring Rows
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('ring_rows', 'beginner',     'angle_deg', 45, '10',   2, '45° from horizontal'),
  ('ring_rows', 'intermediate', 'angle_deg', 20, '10',   2, 'Near horizontal'),
  ('ring_rows', 'advanced',     'angle_deg', 0,  '10',   2, 'Fully horizontal, feet elevated');

-- False Grip Ring Rows
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('false_grip_ring_rows', 'beginner',     'angle_deg', 45, '8',    2, 'False grip maintained throughout'),
  ('false_grip_ring_rows', 'intermediate', 'angle_deg', 20, '10',   2, 'Current range — rep decay flagged'),
  ('false_grip_ring_rows', 'advanced',     'angle_deg', 0,  '10',   2, 'Horizontal, transition-ready');

-- Pull Ups
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('pull_ups', 'beginner',     'weight_kg', 0,  '3-5',  2, 'Bodyweight, full ROM'),
  ('pull_ups', 'intermediate', 'weight_kg', 0,  '8-10', 2, 'Consistent reps, controlled descent'),
  ('pull_ups', 'advanced',     'weight_kg', 16, '8-10', 2, 'Weighted pull-ups');

-- Ring Pull Ups
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('ring_pull_ups', 'beginner',     'weight_kg', 0, '3-5',  2, 'Ring instability managed'),
  ('ring_pull_ups', 'intermediate', 'weight_kg', 0, '8',    2, 'Consistent reps on rings'),
  ('ring_pull_ups', 'advanced',     'weight_kg', 0, '10',   1, 'High volume on rings');

-- Parallette Push-ups
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('parallette_pushups', 'beginner',     'weight_kg', 0, '8-10', 2, 'Neutral grip, full ROM'),
  ('parallette_pushups', 'intermediate', 'weight_kg', 0, '15',   2, 'High volume bodyweight'),
  ('parallette_pushups', 'advanced',     'weight_kg', 0, '20',   2, 'Weighted vest or deficit');

-- Parallette Dips
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('parallette_dips', 'beginner',     'weight_kg', 0,  '5-8',  2, 'Full ROM, shoulders safe'),
  ('parallette_dips', 'intermediate', 'weight_kg', 0,  '10-12',2, 'Controlled, consistent'),
  ('parallette_dips', 'advanced',     'weight_kg', 16, '10',   2, 'Weighted dips');

-- Bulgarian Split Squat
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('bulgarian_split_squat', 'beginner',     'weight_kg', 16,  '8',    2, 'Suitcase hold, stable'),
  ('bulgarian_split_squat', 'intermediate', 'weight_kg', 32,  '8',    2, 'Current range: 40kg'),
  ('bulgarian_split_squat', 'advanced',     'weight_kg', 48,  '8',    2, 'Heavy unilateral squat');

-- KB Swing
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('kb_swing', 'beginner',     'weight_kg', 16,  '15',   2, 'Hip hinge pattern clean'),
  ('kb_swing', 'intermediate', 'weight_kg', 24,  '20',   2, 'Power output consistent'),
  ('kb_swing', 'advanced',     'weight_kg', 32,  '20',   2, 'Heavy single arm swing');

-- L-Sit
INSERT INTO benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes) VALUES
  ('l_sit', 'beginner',     'metric_type', 5,  '5s hold',  2, 'Tuck L-sit'),
  ('l_sit', 'intermediate', 'metric_type', 10, '10s hold', 2, 'Full L-sit, legs extended'),
  ('l_sit', 'advanced',     'metric_type', 20, '20s hold', 2, 'Full L-sit, multiple holds');
