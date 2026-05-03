-- Film Roll Tracker — Database Schema
-- Run this against your PostgreSQL database to initialize the schema.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stripe_customer_id TEXT,
  plan             TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'solo', 'pro')),
  push_subscription JSONB,
  supabase_id      UUID UNIQUE NOT NULL
);

-- Cameras
CREATE TABLE IF NOT EXISTS cameras (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  format     TEXT NOT NULL CHECK (format IN ('35mm', '120', '4x5', 'large_format')),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Film Stocks
CREATE TABLE IF NOT EXISTS film_stocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  iso        INTEGER NOT NULL,
  brand      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('color', 'bw', 'slide')),
  is_custom  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Labs
CREATE TABLE IF NOT EXISTS labs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  website             TEXT,
  location            TEXT,
  avg_turnaround_days INTEGER,
  is_partner          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rolls
CREATE TABLE IF NOT EXISTS rolls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  camera_id       UUID REFERENCES cameras(id) ON DELETE SET NULL,
  film_stock_id   UUID REFERENCES film_stocks(id) ON DELETE SET NULL,
  location        TEXT,
  shoot_date      DATE,
  notes           TEXT,
  frames_shot     INTEGER,
  push_pull       VARCHAR(10),
  status          TEXT NOT NULL DEFAULT 'shot' CHECK (status IN ('shot', 'sent', 'developing', 'returned', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lab Orders
CREATE TABLE IF NOT EXISTS lab_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_id               UUID NOT NULL REFERENCES rolls(id) ON DELETE CASCADE,
  lab_id                UUID NOT NULL REFERENCES labs(id),
  sent_date             DATE NOT NULL,
  service               TEXT NOT NULL CHECK (service IN ('dev_only', 'dev_scan', 'dev_scan_print')),
  estimated_return_date DATE,
  actual_return_date    DATE,
  cost                  DECIMAL(10, 2),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scans
CREATE TABLE IF NOT EXISTS scans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_id       UUID NOT NULL REFERENCES rolls(id) ON DELETE CASCADE,
  file_url      TEXT,
  dropbox_link  TEXT,
  notes         TEXT,
  returned_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rolls_user_id     ON rolls(user_id);
CREATE INDEX IF NOT EXISTS idx_rolls_status      ON rolls(status);
CREATE INDEX IF NOT EXISTS idx_cameras_user_id   ON cameras(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_roll_id ON lab_orders(roll_id);
CREATE INDEX IF NOT EXISTS idx_scans_roll_id     ON scans(roll_id);

-- ────────────────────────────────────────────────────────────
-- Seed: Labs
-- ────────────────────────────────────────────────────────────
INSERT INTO labs (name, website, avg_turnaround_days, is_partner) VALUES
  ('Indie Film Lab',       'https://www.indiefilmlab.com',       18, FALSE),
  ('The Darkroom',         'https://thedarkroom.com',            10, FALSE),
  ('Nationals Photo Lab',  'https://www.nationalsphotolab.com',  10, FALSE),
  ('Not Another Film Lab', 'https://notanotherfilmlab.com',       7, TRUE),
  ('Carmencita Film Lab',  'https://carmencitafilmlab.com',      21, FALSE),
  ('Richard Photo Lab',    'https://richardphotolab.com',         7, FALSE),
  ('Photoworks SF',        'https://photoworkssf.com',           14, FALSE)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- Seed: Film Stocks
-- ────────────────────────────────────────────────────────────
INSERT INTO film_stocks (name, iso, brand, type) VALUES
  ('Kodak Gold 200',         200,  'Kodak',      'color'),
  ('Kodak Ultramax 400',     400,  'Kodak',      'color'),
  ('Kodak Portra 400',       400,  'Kodak',      'color'),
  ('Kodak Portra 160',       160,  'Kodak',      'color'),
  ('Kodak Ektar 100',        100,  'Kodak',      'color'),
  ('Fuji Superia 400',       400,  'Fujifilm',   'color'),
  ('Fujifilm Pro 400H',      400,  'Fujifilm',   'color'),
  ('Kodak Tri-X 400',        400,  'Kodak',      'bw'),
  ('Ilford HP5 Plus 400',    400,  'Ilford',     'bw'),
  ('Ilford Delta 3200',     3200,  'Ilford',     'bw'),
  ('Cinestill 800T',         800,  'Cinestill',  'color'),
  ('Kodak ColorPlus 200',    200,  'Kodak',      'color'),
  ('Fuji Velvia 50',          50,  'Fujifilm',   'slide'),
  ('Kodak T-MAX 400',        400,  'Kodak',      'bw')
ON CONFLICT DO NOTHING;
