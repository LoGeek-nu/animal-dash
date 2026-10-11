CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  speed REAL NOT NULL CHECK (speed >= 0),
  acceleration REAL NOT NULL CHECK (acceleration >= 0),
  stamina REAL NOT NULL CHECK (stamina >= 0),
  image_key TEXT,
  generated INTEGER NOT NULL CHECK (generated IN (0, 1)),
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  created_at INTEGER NOT NULL
);

CREATE TABLE races (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  completed_at INTEGER NOT NULL CHECK (completed_at >= started_at),
  course_seed TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE TABLE race_results (
  race_id TEXT NOT NULL REFERENCES races(id),
  character_id TEXT NOT NULL REFERENCES characters(id),
  lane INTEGER NOT NULL CHECK (lane BETWEEN 1 AND 4),
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 4),
  finish_ms INTEGER CHECK (finish_ms IS NULL OR (finish_ms >= 0 AND typeof(finish_ms) = 'integer')),
  is_bot INTEGER NOT NULL CHECK (is_bot IN (0, 1)),
  character_snapshot TEXT NOT NULL CHECK (json_valid(character_snapshot)),
  PRIMARY KEY (race_id, lane),
  UNIQUE (race_id, character_id)
);

CREATE INDEX races_started_at ON races(started_at);
CREATE INDEX results_ranking ON race_results(character_id, finish_ms, race_id) WHERE finish_ms IS NOT NULL AND is_bot = 0;
