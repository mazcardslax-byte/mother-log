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
-- (idempotent — safe to re-run if table is already in the publication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'app_data'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE app_data;
  END IF;
END $$;
