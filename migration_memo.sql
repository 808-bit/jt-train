-- Coach memo — single-row rolling synthesis, updated after every session
CREATE TABLE IF NOT EXISTS coach_memo (
  id         TEXT PRIMARY KEY DEFAULT 'singleton',
  memo       TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
