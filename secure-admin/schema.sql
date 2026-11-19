-- Execute with: npx wrangler d1 execute amaryt-auth --remote --file=secure-admin/schema.sql
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_challenges_expiry ON challenges(expires_at);
CREATE INDEX IF NOT EXISTS ix_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS ix_rate_expiry ON rate_limits(reset_at);
