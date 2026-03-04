-- Migration: 002_add_structured_ai_columns
-- Description: Add JSONB columns for structured AI SDK outputs (dossier + verdict)
-- Date: 2026-02-06
--
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- Project > SQL Editor > New Query > Paste & Run

-- ============================================================================
-- CANDIDATES TABLE: Structured AI Output Columns
-- These store the full structured responses from generateObject() + Zod schemas
-- The original columns (round_1_dossier, final_verdict) remain for backward compat
-- ============================================================================

-- Full dossier from generateDossier() — contains probeQuestions with targetClaim
-- and probeType, candidateStrengths, areasToProbe, overallAssessment
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS round_1_full_dossier JSONB;

-- Full verdict from generateFinalVerdict() — contains technicalScore, verdict,
-- summary, technicalStrengths, technicalGaps, recommendation
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS full_verdict JSONB;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN candidates.round_1_full_dossier IS 'Structured dossier from AI SDK: probe questions with claims, strengths, areas to probe, assessment';
COMMENT ON COLUMN candidates.full_verdict IS 'Structured final verdict from AI SDK: technical score, strengths, gaps, recommendation';
