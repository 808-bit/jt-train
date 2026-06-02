-- JT.TRAIN — Agentic Insight Layer Migration
-- Run: wrangler d1 execute jt-train-db --file=migration_insights.sql --remote

-- ── 1. Add TUT + rest tracking to sets ───────────────────────────────────────
ALTER TABLE sets ADD COLUMN tut_seconds INTEGER;
ALTER TABLE sets ADD COLUMN rest_seconds INTEGER;

-- ── 2. Debriefs (Status Summary Objects) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS debriefs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id          TEXT NOT NULL REFERENCES sessions(id),
  date                DATE NOT NULL,
  session_type        TEXT NOT NULL,
  total_volume_kg     REAL,
  total_sets          INTEGER,
  performance_signal  TEXT,           -- 'improving' | 'stable' | 'declining'
  shoulder_flag       INTEGER DEFAULT 0,
  exercises_flagged   TEXT,           -- JSON array of exercise_ids
  recommendation      TEXT,           -- one-line tactical directive
  raw_json            TEXT,           -- full Status Summary Object
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_debriefs_session      ON debriefs(session_id);
CREATE INDEX IF NOT EXISTS idx_debriefs_date         ON debriefs(date);
CREATE INDEX IF NOT EXISTS idx_debriefs_session_type ON debriefs(session_type);
