export const DATABASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  access_token_hash TEXT NOT NULL UNIQUE,
  layout TEXT NOT NULL CHECK (layout IN ('classic', 'grid', 'postcard')),
  frame_theme TEXT NOT NULL CHECK (frame_theme IN ('cream', 'blush', 'noir', 'porcelain', 'sky', 'lilac', 'sunset')),
  caption TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  finalized_at TEXT
);

CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('frame', 'strip')),
  position INTEGER NOT NULL CHECK (position >= 0),
  file_name TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shares (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_media_session ON media(session_id);
CREATE INDEX IF NOT EXISTS idx_media_session_kind ON media(session_id, kind, position);
CREATE INDEX IF NOT EXISTS idx_shares_session ON shares(session_id);
CREATE INDEX IF NOT EXISTS idx_shares_hash ON shares(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
`;
