-- ── Body metrics: bodyweight + optional bodyfat over time ──────────────────────
-- One weigh-in per day (upsert on date). Powers lean-bulk trend analytics and
-- the bodyweight side of the "weight lever" (effective load on calisthenics).
CREATE TABLE IF NOT EXISTS body_metrics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL UNIQUE,   -- 'YYYY-MM-DD'
  weight_kg   REAL NOT NULL,
  bodyfat_pct REAL,                   -- nullable: log weight alone on most days
  notes       TEXT,
  logged_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_body_metrics_date ON body_metrics(date);

-- ── Weight lever: fraction of bodyweight a movement loads ───────────────────────
-- effective_load_kg = weight_kg(external) + bw_load_factor * bodyweight_kg
-- 0   = load is fully external (KB/bands) or the work is isometric/time-based
-- 1.0 = full bodyweight hangs from / presses through the arms (pull-up, dip)
ALTER TABLE exercises ADD COLUMN bw_load_factor REAL NOT NULL DEFAULT 0;

-- Vertical pull — full bodyweight on the arms
UPDATE exercises SET bw_load_factor = 1.0  WHERE id IN ('pull_ups','ring_pull_ups');
UPDATE exercises SET bw_load_factor = 1.1  WHERE id = 'ring_muscle_up';                                   -- explosive, >BW at transition
UPDATE exercises SET bw_load_factor = 0.6  WHERE id IN ('band_assisted_chin_ups','band_assisted_ring_pull_ups'); -- band offloads bodyweight

-- Horizontal pull — partial bodyweight, set by torso angle
UPDATE exercises SET bw_load_factor = 0.5  WHERE id IN ('ring_rows','false_grip_ring_rows');
UPDATE exercises SET bw_load_factor = 0.55 WHERE id = 'deep_ring_rows';                                   -- deeper range, higher %BW

-- Vertical / dip push — full bodyweight on the arms
UPDATE exercises SET bw_load_factor = 1.0  WHERE id IN ('ring_dips','parallette_dips');

-- Horizontal push — push-up family ≈ 64% bodyweight
UPDATE exercises SET bw_load_factor = 0.64 WHERE id IN ('push_ups','ring_pushups','parallette_pushups','neutral_grip_parallette_pushups');
UPDATE exercises SET bw_load_factor = 0.7  WHERE id = 'pike_pushups';                                     -- shifted toward vertical
UPDATE exercises SET bw_load_factor = 0.8  WHERE id = 'ring_archer_pushups';                              -- unilateral lever, more load on working arm

-- Everything else stays 0: KB / barbell / band work (external load lives in
-- weight_kg), lower-body KB patterns, and isometric holds (L-sit, support
-- holds, dead hangs) which contribute as hard sets rather than tonnage.
