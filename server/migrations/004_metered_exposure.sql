ALTER TABLE roll_frames
  ADD COLUMN IF NOT EXISTS metered_aperture VARCHAR(20),
  ADD COLUMN IF NOT EXISTS metered_shutter  VARCHAR(20);
