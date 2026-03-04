'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { gemini } from '@/lib/ai';

// Schema for generated interview questions
const InterviewQuestionsSchema = z.object({
  questions: z.array(z.object({
    question: z.string().describe('The interview question to ask'),
    intent: z.string().describe('What this question is designed to reveal about the candidate'),
    followUp: z.string().describe('A follow-up question if the answer is vague'),
    category: z.enum(['technical', 'behavioral', 'situational', 'cultural_fit', 'motivation']),
  })).min(5).max(10),
  focusAreas: z.array(z.string()).describe('Key areas the interview should probe based on resume gaps or job requirements'),
  redFlagProbes: z.array(z.string()).describe('Specific questions to detect red flags mentioned in job context'),
});

export type InterviewQuestions = z.infer<typeof InterviewQuestionsSchema>;

interface GenerateQuestionsInput {
  jobTitle: string;
  jobDescription: string;
  skillsMustHave: string[];
  skillsNiceToHave: string[];
  idealCandidate: string | null;
  redFlags: string | null;
  projectContext: string | null;
  resumeText: string;
  candidateName: string;
}

export async function generatePersonalizedQuestions(input: GenerateQuestionsInput): Promise<InterviewQuestions> {
  const {
    jobTitle,
    jobDescription,
    skillsMustHave,
    skillsNiceToHave,
    idealCandidate,
    redFlags,
    projectContext,
    resumeText,
    candidateName,
  } = input;

  const prompt = `You are an expert technical interviewer. Generate personalized interview questions for a candidate.

## Job Details
**Title:** ${jobTitle}
**Description:** ${jobDescription}

**Must-Have Skills:** ${skillsMustHave.join(', ') || 'Not specified'}
**Nice-to-Have Skills:** ${skillsNiceToHave.join(', ') || 'Not specified'}

${projectContext ? `**Project Context:** ${projectContext}` : ''}
${idealCandidate ? `**Ideal Candidate Profile:** ${idealCandidate}` : ''}
${redFlags ? `**Red Flags to Watch For:** ${redFlags}` : ''}

## Candidate Resume
**Name:** ${candidateName}
${resumeText}

## Instructions
1. Generate 5-10 personalized interview questions based on:
   - Gaps between the resume and job requirements
   - Claims in the resume that should be verified
   - Technical skills that need depth assessment
   - Cultural fit and motivation indicators

2. For each question, explain the intent (what you're trying to learn) and provide a follow-up.

3. Identify focus areas where the interview should probe deeper.

4. If red flags are specified, create specific questions to detect them without being accusatory.

5. Prioritize questions that reveal:
   - Real experience vs theoretical knowledge
   - Problem-solving approach
   - Collaboration and communication style
   - Growth mindset and learning ability
`;

  const { object } = await generateObject({
    model: gemini,
    schema: InterviewQuestionsSchema,
    prompt,
  });

  return object;
}
