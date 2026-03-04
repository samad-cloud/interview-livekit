-- Add round_2_invite_after column for delayed Round 2 invite sending
-- When a candidate passes Round 1 (score >= 70), this timestamp is set to
-- the next day at 10 AM UTC so the invite appears to come after human review.
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS round_2_invite_after TIMESTAMPTZ;
