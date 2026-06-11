-- JT.TRAIN — Equipment config migration
-- Run: wrangler d1 execute jt-train-db --remote --file=migration_equipment.sql

-- ── Add requires_pair to exercises ───────────────────────────────────────────
ALTER TABLE exercises ADD COLUMN requires_pair INTEGER DEFAULT 0;

UPDATE exercises SET requires_pair = 1 WHERE id IN (
  'double_kb_clean',
  'double_kb_deadlift',
  'double_kb_front_squat',
  'double_kb_swing'
);

-- ── Location equipment config ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS location_config (
  location TEXT PRIMARY KEY,
  config   TEXT NOT NULL
);

INSERT OR IGNORE INTO location_config (location, config) VALUES
('Home',   '{"rings":true,"pull_up_bar":true,"parallettes":true,"bands":true,"kb_weights":[16,20,24,32,44],"kb_pairs":false,"barbell":false,"dumbbells":false,"cable_machine":false}'),
('Travel', '{"rings":false,"pull_up_bar":false,"parallettes":false,"bands":true,"kb_weights":[],"kb_pairs":false,"barbell":false,"dumbbells":false,"cable_machine":false}'),
('Gym',    '{"rings":false,"pull_up_bar":true,"parallettes":false,"bands":true,"kb_weights":[8,12,16,20,24,28,32,36,40,44,48],"kb_pairs":true,"barbell":true,"dumbbells":true,"cable_machine":true}');
