-- Migration: 001_enhance_jobs_table
-- Description: Add Job_Input_Document fields to jobs table for enhanced recruiting pipeline
-- Date: 2026-02-06
--
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- Project > SQL Editor > New Query > Paste & Run

-- ============================================================================
-- ENHANCED JOBS TABLE
-- Adds fields required for the Agentic Recruiting Pipeline (Phase 0)
-- ============================================================================

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS work_arrangement TEXT DEFAULT 'onsite',
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT '30_days',
ADD COLUMN IF NOT EXISTS salary_min INTEGER,
ADD COLUMN IF NOT EXISTS salary_max INTEGER,
ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'AED',
ADD COLUMN IF NOT EXISTS salary_period TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS visa_sponsorship BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS education_required TEXT,
ADD COLUMN IF NOT EXISTS experience_min INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS experience_max INTEGER,
ADD COLUMN IF NOT EXISTS skills_must_have TEXT[],
ADD COLUMN IF NOT EXISTS skills_nice_to_have TEXT[],
ADD COLUMN IF NOT EXISTS ideal_candidate TEXT,
ADD COLUMN IF NOT EXISTS red_flags TEXT,
ADD COLUMN IF NOT EXISTS project_context TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================================
-- COMMENTS (for documentation)
-- ============================================================================

COMMENT ON COLUMN jobs.location IS 'Primary work location (e.g., Dubai, London, Remote)';
COMMENT ON COLUMN jobs.work_arrangement IS 'onsite | hybrid | remote';
COMMENT ON COLUMN jobs.department IS 'Team or department name';
COMMENT ON COLUMN jobs.urgency IS 'asap | 30_days | 60_days | 90_days';
COMMENT ON COLUMN jobs.salary_min IS 'Minimum salary (integer)';
COMMENT ON COLUMN jobs.salary_max IS 'Maximum salary (integer)';
COMMENT ON COLUMN jobs.salary_currency IS 'Currency code (AED, USD, GBP, etc.)';
COMMENT ON COLUMN jobs.salary_period IS 'monthly | yearly';
COMMENT ON COLUMN jobs.visa_sponsorship IS 'Whether company offers visa sponsorship';
COMMENT ON COLUMN jobs.education_required IS 'none | bachelors | masters | phd';
COMMENT ON COLUMN jobs.experience_min IS 'Minimum years of experience';
COMMENT ON COLUMN jobs.experience_max IS 'Maximum years of experience';
COMMENT ON COLUMN jobs.skills_must_have IS 'Array of required skills';
COMMENT ON COLUMN jobs.skills_nice_to_have IS 'Array of preferred skills';
COMMENT ON COLUMN jobs.ideal_candidate IS 'Free text describing the ideal hire profile';
COMMENT ON COLUMN jobs.red_flags IS 'Free text describing what to avoid in candidates';
COMMENT ON COLUMN jobs.project_context IS 'Description of actual work/projects for this role';

-- ============================================================================
-- OPTIONAL: Add updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
