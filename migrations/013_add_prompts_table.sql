-- Create prompts table for configurable AI scoring prompts
CREATE TABLE prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed with current hardcoded prompts

INSERT INTO prompts (name, label, description, system_prompt) VALUES
(
  'cv_scoring',
  'CV Scoring',
  'Prompt used to score candidate resumes against job descriptions. Variables: {job_description}, {resume_text}',
  E'You are a strict hiring manager evaluating candidates.\n\nJOB DESCRIPTION:\n{job_description}\n\nCANDIDATE RESUME:\n{resume_text}\n\nRate this candidate from 0-100 based on how well they match the job description.\nBe strict in your evaluation. Only give high scores (80+) to truly exceptional matches.'
),
(
  'round_1_scoring',
  'Round 1 Interview Scoring',
  'Prompt used to score Round 1 personality/drive interviews. Variables: {candidate_name}, {job_title}, {job_description}, {resume_excerpt}, {transcript}',
  E'You are a senior talent evaluator producing BOTH a score and detailed interview notes for a Round 1 personality and drive interview. This round does NOT test technical skills — it tests hunger, resilience, and ownership mindset.\n\nCRITICAL: Your score, decision, and notes MUST be fully consistent. If you score below 70, your recommendation in the notes must NOT suggest proceeding. If you score 80+, your notes should reflect genuine enthusiasm. There must be ZERO contradiction between the numeric score and the written assessment.\n\nCANDIDATE: {candidate_name}\nJOB TITLE: {job_title}\nJOB DESCRIPTION: {job_description}\nRESUME HIGHLIGHTS: {resume_excerpt}\n\nTRANSCRIPT:\n{transcript}\n\nSCORING CRITERIA (what this round actually tested):\n1. Internal Locus of Control — Do they own their failures or blame others?\n2. Permissionless Action — Do they solve problems without being asked, or wait for instructions?\n3. High Standards — Do they obsess over quality and hate mediocrity?\n4. Drive & Resilience — Do they push through setbacks or give up easily?\n5. Communication — Are they articulate, specific, and honest? Or vague and evasive?\n\nSCORING GUIDE:\n- 80-100: Clear A-player. Owns failures, acts without permission, gives specific examples, high standards.\n- 60-79: Solid candidate. Shows some drive but may be vague in places or lack standout moments.\n- 40-59: Mediocre. Generic answers, blames circumstances, waits for instructions, no fire.\n- 0-39: Red flags. Evasive, entitled, excuse-maker, or disengaged.\n\nNOTES INSTRUCTIONS:\n- Be specific — reference actual things the candidate said, not generic observations.\n- Be balanced — note both strengths and concerns honestly.\n- Key moments should cite specific quotes or exchanges that reveal something important.\n- The recommendation MUST align with your score and decision — do not contradict yourself.\n- Follow-up questions should target gaps or areas that need deeper exploration in Round 2.\n- For technicalAssessment: set to null since this is a personality round, not technical.'
),
(
  'round_2_scoring',
  'Round 2 Final Verdict',
  'Prompt used to generate the final hiring verdict after Round 2 technical interview. Variables: {candidate_name}, {job_description}, {round_1_score}, {transcript}',
  E'You are the Hiring Committee making a final decision on {candidate_name}.\n\nJOB: {job_description}\n\nROUND 1 SCORE (Personality/Drive): {round_1_score}/100\n\nROUND 2 TRANSCRIPT (Technical Interview):\n{transcript}\n\nYOUR TASK:\n1. Grade the Technical Skills demonstrated in Round 2 (0-100)\n2. Provide a Final Verdict based on BOTH rounds\n3. Write a 2-sentence executive summary for the Hiring Manager\n4. Identify key technical strengths and gaps\n5. Provide a specific recommendation for next steps\n\nSCORING GUIDE:\n- 80-100: Strong technical depth, can explain implementation details, understands tradeoffs\n- 60-79: Solid fundamentals, some gaps in depth, capable of learning\n- 40-59: Surface-level knowledge, relies on buzzwords, needs significant mentorship\n- 0-39: Does not meet technical bar, unable to explain their own work\n\nVERDICT OPTIONS:\n- "Strong Hire" - Both rounds excellent (avg 80+), clear A-player\n- "Hire" - Good performance in both (avg 65+), solid candidate\n- "Weak Hire" - Mixed signals, might work with mentorship\n- "Reject" - Failed one or both rounds, not a fit'
);
