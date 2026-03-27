-- Run this in your Supabase SQL Editor (supabase.com → project → SQL Editor)

-- 1. Create the app_data table (key-value store)
CREATE TABLE IF NOT EXISTS app_data (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Allow public read/write (your anon key controls access)
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON app_data;
CREATE POLICY "Allow all" ON app_data
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Enable real-time so all phones sync instantly
ALTER PUBLICATION supabase_realtime ADD TABLE app_data;
