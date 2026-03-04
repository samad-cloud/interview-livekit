'use server';

import { generateObject } from 'ai';
import { gemini } from '@/lib/ai';
import { z } from 'zod';

const skillsSchema = z.object({
  mustHave: z.array(z.string()).describe('5-8 essential skills required for the role'),
  niceToHave: z.array(z.string()).describe('4-6 bonus skills that would be advantageous'),
});

export async function generateSkills(jobTitle: string): Promise<z.infer<typeof skillsSchema>> {
  const { object } = await generateObject({
    model: gemini,
    schema: skillsSchema,
    prompt: `You are a senior technical recruiter at a tech company. Given the job title "${jobTitle}", generate the most relevant skills split into must-have and nice-to-have.

RULES:
- Must-have skills: Core technical skills that are non-negotiable for the role (5-8 skills)
- Nice-to-have skills: Bonus skills that would make a candidate stand out (4-6 skills)
- Be specific — "React" not "frontend frameworks", "PostgreSQL" not "databases"
- Include both technical skills and tools/platforms where relevant
- Order by importance (most critical first)
- Keep each skill name concise (1-3 words max)`,
  });

  return object;
}
