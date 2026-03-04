'use server';

import { generateObject } from 'ai';
import { gemini } from '@/lib/ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const interviewNotesSchema = z.object({
  overallImpression: z.string().describe('2-3 sentence overall impression of the candidate'),
  strengths: z.array(z.string()).describe('3-5 key strengths demonstrated during the interview'),
  concerns: z.array(z.string()).describe('2-4 concerns or areas of weakness'),
  keyMoments: z.array(z.object({
    moment: z.string().describe('Brief description of the notable moment'),
    significance: z.enum(['positive', 'negative', 'neutral']).describe('Whether this moment was positive, negative, or neutral'),
  })).describe('3-5 notable moments from the interview'),
  technicalAssessment: z.string().nullable().describe('Assessment of technical ability if applicable, null if not a technical interview'),
  cultureFit: z.string().describe('Assessment of personality, communication style, and culture fit'),
  recommendation: z.string().describe('Clear hiring recommendation with reasoning in 1-2 sentences'),
  followUpQuestions: z.array(z.string()).describe('2-3 questions to explore in the next round or reference check'),
});

export type InterviewNotes = z.infer<typeof interviewNotesSchema>;

export async function generateInterviewNotes({
  candidateId,
  candidateName,
  jobTitle,
  round1Transcript,
  round2Transcript,
}: {
  candidateId: number;
  candidateName: string;
  jobTitle?: string;
  round1Transcript?: string | null;
  round2Transcript?: string | null;
}): Promise<InterviewNotes> {
  const transcriptParts: string[] = [];

  if (round1Transcript) {
    transcriptParts.push(`=== ROUND 1 TRANSCRIPT (Personality & Motivation) ===\n${round1Transcript}`);
  }
  if (round2Transcript) {
    transcriptParts.push(`=== ROUND 2 TRANSCRIPT (Technical Assessment) ===\n${round2Transcript}`);
  }

  if (transcriptParts.length === 0) {
    throw new Error('No interview transcripts available to generate notes from.');
  }

  const { object } = await generateObject({
    model: gemini,
    schema: interviewNotesSchema,
    prompt: `You are a senior hiring manager reviewing interview transcripts. Generate structured interview notes for the candidate.

CANDIDATE: ${candidateName}
${jobTitle ? `ROLE: ${jobTitle}` : ''}

${transcriptParts.join('\n\n')}

INSTRUCTIONS:
- Be specific — reference actual things the candidate said, not generic observations
- Be balanced — note both strengths and concerns honestly
- Key moments should be specific quotes or exchanges that reveal something important
- The recommendation should be actionable and clear
- Follow-up questions should target gaps or areas that need deeper exploration
- If both rounds are present, synthesize insights from both into a cohesive assessment`,
  });

  // Persist notes to database
  const { error } = await supabase
    .from('candidates')
    .update({ interview_notes: object })
    .eq('id', candidateId);

  if (error) {
    console.error('Failed to save interview notes:', error);
  }

  return object;
}
