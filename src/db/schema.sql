-- GRIP Database Schema
-- Distances stored in metres internally; displayed per app_settings.odo_unit

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Rallies ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rallies (
  id          TEXT PRIMARY KEY,   -- UUID
  name        TEXT NOT NULL,      -- e.g. "Rocky Mountain Rally"
  date        TEXT NOT NULL,      -- ISO 8601 date "YYYY-MM-DD"
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Stages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stages (
  id          TEXT PRIMARY KEY,   -- UUID
  rally_id    TEXT NOT NULL REFERENCES rallies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,      -- e.g. "SS1 – Rocky Mountain"
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Note Sets ──────────────────────────────────────────────────────────────
-- A stage can have multiple note sets (recce passes, revisions, versions)
CREATE TABLE IF NOT EXISTS note_sets (
  set_id      TEXT PRIMARY KEY,   -- UUID
  stage_id    TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL DEFAULT 1,
  recce_date  TEXT,               -- ISO 8601 date of this recce pass
  is_active   INTEGER NOT NULL DEFAULT 1,  -- 1 = current working set
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Pace Notes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pace_notes (
  set_id          TEXT NOT NULL REFERENCES note_sets(set_id) ON DELETE CASCADE,
  seq             INTEGER NOT NULL,   -- sequential order within set
  index_odo       INTEGER,            -- metres along stage
  index_landmark  TEXT,               -- text landmark reference
  index_sequence  INTEGER,            -- alternate sequence index (e.g. numbered boards)
  direction       TEXT,               -- "left" | "right" | "straight" | null
  severity        TEXT,               -- "1"–"6" | "hairpin" | "square" | freetext | null
  duration        TEXT,               -- "long" | "short" | freetext | null
  decorators      TEXT,               -- JSON array e.g. ["caution","tightens","don't cut"]
  joiner          TEXT,               -- distance or transition to next note e.g. "100", "into", "tightens"
  notes           TEXT,               -- freetext annotation / co-driver reminder
  recce_at        TEXT,               -- timestamp when this note was recorded on recce
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (set_id, seq)
);

-- ─── Stage Geometry (optional, future use) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS stage_geometry (
  set_id              TEXT NOT NULL REFERENCES note_sets(set_id) ON DELETE CASCADE,
  seq                 INTEGER NOT NULL,
  length_m            INTEGER,        -- length of this segment in metres
  h_angle             REAL,           -- horizontal heading change (degrees)
  left_surfaces       TEXT,           -- JSON array of surface strip objects
  right_surfaces      TEXT,           -- JSON array of surface strip objects
  roadside_left       TEXT,           -- JSON array of roadside feature objects
  roadside_right      TEXT,           -- JSON array of roadside feature objects
  PRIMARY KEY (set_id, seq)
);

-- ─── App Settings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Defaults
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('display_order', 'direction_first'),  -- "direction_first" | "severity_first"
  ('odo_unit',      'metres'),           -- "metres" | "km"
  ('active_rally_id', NULL);
