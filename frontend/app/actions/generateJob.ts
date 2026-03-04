'use server';

import { generateText, generateObject } from 'ai';
import { gemini, google } from '@/lib/ai';
import { z } from 'zod';

interface JobGenerationParams {
  title: string;
  salary: string;
  location: string;
  companyName?: string;
  companyContext?: string;
  experienceLevel?: string;
  keySkills?: string;
  employmentType?: string;
  mustHave?: string;
  niceToHave?: string;
  companyPerks?: string;
}

export interface JobCitation {
  url: string;
  title: string;
}

interface JobGenerationResult {
  description: string;
  citations: JobCitation[];
}

export async function generateJobDescription(params: JobGenerationParams): Promise<JobGenerationResult> {
  // Build context from optional fields
  const contextParts: string[] = [];

  if (params.experienceLevel) {
    contextParts.push(`Experience Level: ${params.experienceLevel}`);
  }
  if (params.keySkills) {
    contextParts.push(`Key Skills Required: ${params.keySkills}`);
  }
  if (params.employmentType) {
    contextParts.push(`Employment Type: ${params.employmentType}`);
  }
  if (params.mustHave) {
    contextParts.push(`Must-Have Requirements: ${params.mustHave}`);
  }
  if (params.niceToHave) {
    contextParts.push(`Nice-to-Have: ${params.niceToHave}`);
  }
  if (params.companyPerks) {
    contextParts.push(`Company Perks to Highlight: ${params.companyPerks}`);
  }

  const additionalContext = contextParts.length > 0
    ? `\n\nADDITIONAL CONTEXT:\n${contextParts.join('\n')}`
    : '';

  const companySection = params.companyContext
    ? `\n\nCOMPANY CONTEXT (use this to write a compelling "About ${params.companyName || 'the Company'}" opening section):\n${params.companyContext}`
    : '';

  // Step 1: Research competitor JDs using Google Search grounding
  const { text: competitorResearch, sources } = await generateText({
    model: google('gemini-2.5-flash'),
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    prompt: `You are a recruiting intelligence analyst. Search for REAL job postings currently live for "${params.title}" roles in ${params.location} (or similar markets if ${params.location} has few results).

Analyze 5-8 competitor job descriptions and produce a structured report:

1. **Common Phrases to AVOID** — List the generic, overused phrases you see repeated across multiple JDs (e.g., "fast-paced environment", "competitive salary", "make an impact", "career progression is actively supported"). These are noise that every company uses.

2. **Growth & Career Gaps** — How do competitors describe growth? Flag which ones are vague ("career growth opportunities") vs. specific ("Junior to Senior in 18 months", "mentorship from Staff Engineers"). Most will be vague — note that.

3. **What Top JDs Do Differently** — Identify 2-3 standout JDs that are genuinely compelling. What makes them different? (Specific projects mentioned? Named technologies with context? Clear team structure? Honest about challenges?)

4. **Salary Positioning** — How does "${params.salary}" compare to what competitors are offering for this role in this market?

5. **Missing Differentiators** — What do NONE of the competitor JDs mention that a smart candidate would actually care about? (Team size, who they report to, first-90-days plan, what success looks like, tech stack specifics, mentorship structure)

Be specific. Quote actual phrases you find. Name patterns.`,
  });

  // Step 2: Generate the JD using research insights
  const jobDescriptionSchema = z.object({
    jobDescription: z.string().describe('The complete job description in clean Markdown format. No preamble, no commentary — only the JD itself.'),
  });

  const { object } = await generateObject({
    model: gemini,
    schema: jobDescriptionSchema,
    prompt: `You are an elite Technical Recruiter who writes JDs that top candidates actually respond to. You have just received competitor intelligence for this role. Use it to write a JD that is CLEARLY better than what's out there.

CORE DETAILS:
- Job Title: ${params.title}
- Location: ${params.location}
- Salary: ${params.salary}${additionalContext}${companySection}

COMPETITOR RESEARCH (use this to differentiate):
${competitorResearch}

ANTI-GENERIC RULES — These are NON-NEGOTIABLE:
1. **No hollow growth promises.** Don't say "career progression is actively supported." Instead, describe the ACTUAL path: who they learn from, what they'll own in 3/6/12 months, what the promotion ladder looks like. If mentorship exists, name the structure (weekly 1:1s with a senior engineer? Pair programming? Code reviews?). If this is a solo role, be HONEST — "You'll be the founding AI engineer, building the function from scratch" is more compelling than fake mentorship promises.

2. **No vague impact claims.** Don't say "make a significant impact." Instead, describe WHAT they are building and WHY it matters. "You'll build agentic AI workflows that automate recruiting for 500+ hires/year" beats "make an impact on our AI initiatives." Be concrete about the problem, the scale, and why it's hard.

3. **No buzzword salads.** Every requirement must connect to actual work. Don't list "Python" — say "Python (you'll build data pipelines that process 10K+ resumes/month)." Don't list "communication skills" — say "You'll present technical proposals to non-technical leadership weekly."

4. **Differentiate from competitors.** You have the research above. Whatever phrases EVERY competitor uses — don't use them. Find a different angle. If every JD says "collaborative team," describe the team instead (size, backgrounds, what they shipped recently).

5. **Honest > Aspirational.** Candidates trust JDs that acknowledge trade-offs. "We're a 15-person team — you'll wear multiple hats but ship fast" is more believable than "world-class engineering organization."

6. **First 90 Days.** Include a "Your First 90 Days" section — what will they actually DO? Week 1, Month 1, Month 3. This is what competitors don't do and candidates love.

OUTPUT RULES:
- Return ONLY the job description. No introductory text, no commentary, no "here is the JD" preamble.
- Use clean Markdown (## for headers, - for bullets).
- Sections: ${params.companyContext ? `About ${params.companyName || 'the Company'} (a compelling paragraph that makes candidates excited — use the COMPANY CONTEXT provided, don't make things up), ` : ''}Role Summary (2-3 punchy sentences, not a paragraph), What You'll Build (specific projects/problems), Your First 90 Days, What We're Looking For (requirements with context for each), Nice-to-Have, Why This Role (not generic "why join us" — why THIS specific role is a good career move right now).
- Tone: Direct, honest, specific. Write like you're talking to a smart person, not filing a corporate form.
- Keep it concise but thorough.`,
  });

  // Extract citations from search grounding sources
  const citations: JobCitation[] = (sources ?? [])
    .filter((s): s is typeof s & { url: string; title: string } =>
      s.sourceType === 'url' && !!s.url
    )
    .map(s => ({ url: s.url, title: s.title || new URL(s.url).hostname }))
    // Deduplicate by URL
    .filter((c, i, arr) => arr.findIndex(x => x.url === c.url) === i);

  return { description: object.jobDescription, citations };
}

export async function refineJobDescription(currentDescription: string, feedback: string): Promise<string> {
  const schema = z.object({
    jobDescription: z.string().describe('The complete revised job description in clean Markdown format. No preamble or commentary — only the JD itself.'),
  });

  const { object } = await generateObject({
    model: gemini,
    schema,
    prompt: `You are an elite Technical Recruiter. Below is an existing job description that was written by an AI. The HR team has reviewed it and has specific feedback. Apply their feedback precisely while preserving the quality, tone, and structure of the original.

CURRENT JOB DESCRIPTION:
${currentDescription}

HR FEEDBACK / REQUESTED CHANGES:
${feedback}

RULES:
- Apply the requested changes accurately and completely.
- Preserve all sections that were not mentioned in the feedback.
- Keep the same direct, honest, specific tone as the original.
- Return ONLY the revised job description. No preamble, no commentary, no "here is the updated JD".
- Use clean Markdown (## for headers, - for bullets).`,
  });

  return object.jobDescription;
}
