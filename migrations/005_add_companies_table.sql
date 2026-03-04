-- 005: Add companies table and link to jobs
-- Run this in the Supabase SQL Editor

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  about text NOT NULL,
  industry text,
  website text,
  headquarters text,
  size text,
  culture text,
  created_at timestamptz DEFAULT now()
);

-- Link jobs to companies
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
