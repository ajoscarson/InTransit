CREATE TABLE IF NOT EXISTS roll_frames (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_id       UUID NOT NULL REFERENCES rolls(id) ON DELETE CASCADE,
  frame_number  INTEGER NOT NULL,
  aperture      VARCHAR(20),
  shutter_speed VARCHAR(20),
  notes         TEXT,
  location_id   UUID REFERENCES roll_locations(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(roll_id, frame_number)
);

CREATE INDEX IF NOT EXISTS idx_roll_frames_roll_id ON roll_frames(roll_id);
