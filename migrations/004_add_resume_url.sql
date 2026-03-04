-- Migration: 004_add_resume_url
-- Description: Add column to store the original resume PDF URL from Supabase Storage
-- Date: 2026-02-12
--
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- Project > SQL Editor > New Query > Paste & Run

-- PREREQUISITE: Create the 'resumes' storage bucket in Supabase Dashboard
-- Go to: Storage > New Bucket > Name: "resumes" > Public: ON > Create

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS resume_url TEXT;

COMMENT ON COLUMN candidates.resume_url IS 'Public URL to the original resume PDF stored in Supabase Storage (resumes bucket)';
