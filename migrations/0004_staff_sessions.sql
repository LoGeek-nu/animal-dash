CREATE TABLE staff_sessions (
  session_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
);

CREATE INDEX staff_sessions_expires_at ON staff_sessions(expires_at);
