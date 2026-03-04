'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { gemini } from '@/lib/ai';
import { createClient } from '@supabase/supabase-js';

// Schema for probe questions dossier
const DossierSchema = z.object({
  probeQuestions: z.array(z.object({
    question: z.string().describe('A deep technical probe question'),
    targetClaim: z.string().describe('The specific claim or project from Round 1 this question probes'),
    probeType: z.enum(['implementation_details', 'tradeoffs', 'scale_metrics', 'debugging', 'architecture']),
  })).min(3).max(5),
  softSkillProbes: z.array(z.object({
    question: z.string().describe('A follow-up question to dig deeper into a soft skill claim from Round 1'),
    targetClaim: z.string().describe('The specific soft skill claim or story from Round 1 this question revisits'),
    skillArea: z.enum(['entrepreneurship', 'resourcefulness', 'drive_ambition', 'proactiveness_ownership', 'collaboration_communication']),
  })).min(2).max(4).describe('Soft skill deep dive questions based on Round 1 responses'),
  candidateStrengths: z.array(z.string()).describe('Key strengths identified from Round 1'),
  areasToProbe: z.array(z.string()).describe('Areas that need deeper verification in Round 2'),
  overallAssessment: z.string().describe('Brief assessment of Round 1 performance'),
});

export type Dossier = z.infer<typeof DossierSchema>;

interface DossierResult {
  success: boolean;
  dossier?: string[];
  fullDossier?: Dossier;
  error?: string;
}

export async function generateDossier(candidateId: string): Promise<DossierResult> {
  try {
    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: 'Supabase not configured' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate data
    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('interview_transcript, job_description, job_id')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      console.error('Failed to fetch candidate:', fetchError);
      return { success: false, error: 'Candidate not found' };
    }

    // Get job description from jobs table if not on candidate
    let jobDesc = candidate.job_description || '';
    if (!jobDesc && candidate.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('description, title')
        .eq('id', candidate.job_id)
        .single();

      if (job) {
        jobDesc = `${job.title}: ${job.description || ''}`;
      }
    }

    const transcript = candidate.interview_transcript;

    if (!transcript) {
      console.error('No transcript found for candidate');
      return { success: false, error: 'No interview transcript found' };
    }

    // Generate the dossier using AI SDK with structured output
    const prompt = `You are a Senior Technical Architect preparing for a Round 2 technical interview.

CANDIDATE'S ROUND 1 INTERVIEW TRANSCRIPT:
${transcript.substring(0, 6000)}

JOB DESCRIPTION:
${jobDesc.substring(0, 1500) || 'Software Engineering Role'}

YOUR TASK:
Analyze the Round 1 transcript thoroughly and prepare a dossier for Round 2.

PART 1 — TECHNICAL PROBE QUESTIONS:
1. Identify 3-5 specific technical claims, projects, or accomplishments the candidate mentioned
2. For EACH claim, create a "Probe Question" that tests their DEEP technical understanding

RULES FOR TECHNICAL PROBE QUESTIONS:
- Ask for specific implementation details (e.g., "How exactly did you handle race conditions?")
- Ask about tradeoffs and decisions (e.g., "Why did you choose that approach over X?")
- Ask about scale and metrics (e.g., "How many requests per second? What was the latency?")
- Do NOT accept buzzwords - these questions should expose if they actually built it vs. just talked about it

PART 2 — SOFT SKILL DEEP DIVE QUESTIONS:
Identify 2-4 specific soft skill claims or stories from Round 1 and create follow-up questions to dig deeper in Round 2. Focus on these five areas:
- Entrepreneurship: Did they mention building something, starting a project, or thinking like an owner?
- Resourcefulness: Did they describe overcoming a lack of resources or finding creative solutions?
- Drive & Ambition: Did they talk about career goals, ambitious challenges, or pushing through difficulty?
- Proactiveness & Ownership: Did they describe fixing problems without being asked or going beyond their job description?
- Collaboration & Communication: Did they mention working with teams, resolving conflicts, or leading others?

RULES FOR SOFT SKILL PROBES:
- Reference SPECIFIC stories or claims from Round 1 (e.g., "You mentioned leading a team of 5 — tell me about a time that team disagreed with you")
- Push for deeper detail, outcomes, and lessons learned
- Look for consistency — will their Round 2 answers match Round 1?

Also identify:
- Key strengths demonstrated in Round 1
- Areas that need deeper verification
- Overall assessment of their Round 1 performance`;

    const { object: fullDossier } = await generateObject({
      model: gemini,
      schema: DossierSchema,
      prompt,
    });

    // Extract question strings — technical probes + soft skill probes for backward compatibility
    const technicalQuestions = fullDossier.probeQuestions.map(q => q.question);
    const softSkillQuestions = fullDossier.softSkillProbes.map(q => `[Soft Skill - ${q.skillArea.replace(/_/g, ' ')}] ${q.question}`);
    const dossier = [...technicalQuestions, ...softSkillQuestions];

    // Update the candidate record with both formats
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        round_1_dossier: dossier,
        round_1_full_dossier: fullDossier,
        current_stage: 'round_2',
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('Failed to update candidate with dossier:', updateError);
      return { success: false, error: 'Failed to save dossier' };
    }

    console.log(`[Dossier] Generated ${dossier.length} probe questions for candidate ${candidateId}`);

    return { success: true, dossier, fullDossier };

  } catch (error) {
    console.error('Generate dossier error:', error);
    return { success: false, error: 'Failed to generate dossier' };
  }
}
