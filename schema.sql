-- JT.TRAIN — Cloudflare D1 Schema
-- Run: wrangler d1 execute jt-train-db --file=schema.sql

PRAGMA foreign_keys = ON;

-- ── Phases ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phases (
  id          TEXT PRIMARY KEY,  -- 'lean-bulk-q2-2026'
  name        TEXT NOT NULL,     -- 'Lean Bulk Q2 2026'
  goal        TEXT,              -- 'Hypertrophy, lean bulk'
  start_date  DATE,
  end_date    DATE
);

-- ── Sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,  -- '2026-05-25-A'
  phase_id      TEXT REFERENCES phases(id),
  date          DATE NOT NULL,
  week_num      INTEGER,           -- week within phase
  session_type  TEXT NOT NULL,     -- 'Full Body A' etc
  location      TEXT NOT NULL,     -- 'Home' / 'Travel' / 'Gym'
  rpe           INTEGER,           -- 1-10, post-session
  notes         TEXT,
  ai_plan_used  INTEGER DEFAULT 1, -- 1 = TRUE
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_date         ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_session_type ON sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_sessions_phase_id     ON sessions(phase_id);

-- ── Exercises ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercises (
  id               TEXT PRIMARY KEY,  -- 'kb-goblet-squat'
  display_name     TEXT NOT NULL,
  category         TEXT NOT NULL,     -- 'Upper' / 'Lower' / 'Core' / 'Full Body'
  equipment        TEXT NOT NULL,     -- 'KB' / 'Rings' / 'BW' / 'Parallettes' / 'Bands'
  movement_pattern TEXT,              -- 'squat' / 'hinge' / 'push' / 'pull' / 'carry' / 'core'
  muscle_groups    TEXT,              -- JSON array e.g. '["quads","glutes"]'
  session_types    TEXT,              -- semicolon-delimited: 'Full Body A;Lower Body'
  bilateral        INTEGER DEFAULT 1,  -- 1 = bilateral, 0 = unilateral
  home_available   INTEGER DEFAULT 1,
  shoulder_safe    INTEGER DEFAULT 1,
  notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);

-- ── Session plan (AI prescription) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_plan (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       TEXT NOT NULL REFERENCES sessions(id),
  exercise_id      TEXT NOT NULL REFERENCES exercises(id),
  order_num        INTEGER,          -- exercise order in session
  prescribed_sets  INTEGER,
  prescribed_reps  TEXT,             -- '8-10'
  prescribed_weight TEXT,            -- '32kg'
  tempo            TEXT,             -- '3-0-1-0'
  rir              INTEGER,
  notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_plan_session ON session_plan(session_id);

-- ── Sets (actual logged performance) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL REFERENCES sessions(id),
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  set_num     INTEGER NOT NULL,
  reps        INTEGER,
  weight_kg   REAL DEFAULT 0,
  rir         INTEGER,
  tempo       TEXT,
  notes       TEXT,
  logged_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sets_session    ON sets(session_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise   ON sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sets_logged_at  ON sets(logged_at);

-- ── Injuries ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS injuries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  body_part    TEXT NOT NULL,   -- 'Right shoulder'
  restrictions TEXT,            -- 'No overhead pressing'
  active       INTEGER DEFAULT 1,
  date_start   DATE,
  date_end     DATE,
  notes        TEXT
);

-- ── Seed: current phase ───────────────────────────────────────────────────────
INSERT OR IGNORE INTO phases (id, name, goal, start_date)
VALUES ('lean-bulk-q2-2026', 'Lean Bulk Q2 2026', 'Hypertrophy, lean bulk', '2026-04-01');

-- ── Seed: current injury ──────────────────────────────────────────────────────
INSERT OR IGNORE INTO injuries (body_part, restrictions, active, date_start, notes)
VALUES ('Right shoulder', 'No overhead pressing, avoid internal rotation under load', 1, '2026-03-10', 'Impingement, physio confirmed');
