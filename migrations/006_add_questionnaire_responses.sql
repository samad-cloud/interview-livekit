-- Add questionnaire_responses JSONB column to store Tally form submissions
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS questionnaire_responses jsonb;
