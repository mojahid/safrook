
CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_state (id, payload)
VALUES ('safrook', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
