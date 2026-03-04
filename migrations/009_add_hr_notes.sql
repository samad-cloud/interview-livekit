-- Add hr_notes column for human reviewer notes on candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS hr_notes TEXT;
