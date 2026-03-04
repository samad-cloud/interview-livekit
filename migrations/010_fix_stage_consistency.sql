-- Migration 010: Fix candidate stage data consistency
-- Ensures current_stage and status align with the new stage display system

-- 1. Candidates who completed R2 (have round_2_rating) but current_stage is not 'completed'
UPDATE candidates
SET current_stage = 'completed'
WHERE round_2_rating IS NOT NULL
  AND (current_stage IS NULL OR current_stage != 'completed');

-- 2. Candidates in R2 pipeline (ROUND_2_APPROVED or ROUND_2_INVITED) but missing current_stage
UPDATE candidates
SET current_stage = 'round_2'
WHERE status IN ('ROUND_2_APPROVED', 'ROUND_2_INVITED')
  AND round_2_rating IS NULL
  AND (current_stage IS NULL OR current_stage != 'round_2');

-- 3. Candidates with rating >= 70 but still showing as INTERVIEWED (should be ROUND_2_APPROVED)
-- These may have been scored before auto-invite was added
UPDATE candidates
SET status = 'ROUND_2_APPROVED'
WHERE rating >= 70
  AND status = 'INTERVIEWED'
  AND round_2_rating IS NULL;
