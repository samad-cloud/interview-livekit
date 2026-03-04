-- Add interview date tracking columns
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS round_1_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS round_2_completed_at timestamptz;

-- Set default for applied_at on new records
ALTER TABLE candidates ALTER COLUMN applied_at SET DEFAULT now();

-- Backfill applied_at from created_at for all existing records
UPDATE candidates SET applied_at = created_at WHERE applied_at IS NULL AND created_at IS NOT NULL;

-- Backfill round_1_completed_at from storage recording timestamps
UPDATE candidates c
SET round_1_completed_at = sub.recording_date
FROM (
  SELECT DISTINCT ON (candidate_id)
    split_part(split_part(name, '/', 2), '-', 1)::bigint AS candidate_id,
    created_at AS recording_date
  FROM storage.objects
  WHERE bucket_id = 'interview-recordings'
    AND name LIKE 'round1/%'
  ORDER BY candidate_id, created_at DESC
) sub
WHERE c.id = sub.candidate_id
  AND c.round_1_completed_at IS NULL;

-- Backfill round_2_completed_at from storage recording timestamps
UPDATE candidates c
SET round_2_completed_at = sub.recording_date
FROM (
  SELECT DISTINCT ON (candidate_id)
    split_part(split_part(name, '/', 2), '-', 1)::bigint AS candidate_id,
    created_at AS recording_date
  FROM storage.objects
  WHERE bucket_id = 'interview-recordings'
    AND name LIKE 'round2/%'
  ORDER BY candidate_id, created_at DESC
) sub
WHERE c.id = sub.candidate_id
  AND c.round_2_completed_at IS NULL;
