CREATE TABLE IF NOT EXISTS roll_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_id     UUID NOT NULL REFERENCES rolls(id) ON DELETE CASCADE,
  location    TEXT NOT NULL,
  frame_start INTEGER,
  frame_end   INTEGER,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roll_locations_roll_id ON roll_locations(roll_id);
