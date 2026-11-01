ALTER TABLE race_results ADD COLUMN ranking_excluded INTEGER NOT NULL DEFAULT 0 CHECK (ranking_excluded IN (0, 1));
