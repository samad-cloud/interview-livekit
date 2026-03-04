-- Add columns to track when invites were sent and when reminders were sent
-- Used by the reminder system to send follow-up emails after 3 days of no response

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Backfill invite_sent_at for candidates who already have INVITE_SENT or later statuses
-- Use created_at as a reasonable approximation
UPDATE candidates
SET invite_sent_at = created_at
WHERE invite_sent_at IS NULL
  AND status IN ('INVITE_SENT', 'INTERVIEW_STARTED', 'INTERVIEWED', 'COMPLETED', 'ROUND_2_INVITED');
