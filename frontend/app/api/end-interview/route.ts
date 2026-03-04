import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai';
import { generateDossier } from '@/app/actions/generateDossier';

interface InterviewNotes {
  overallImpression: string;
  strengths: string[];
  concerns: string[];
  keyMoments: { moment: string; significance: 'positive' | 'negative' | 'neutral' }[];
  technicalAssessment: string | null;
  cultureFit: string;
  recommendation: string;
  followUpQuestions: string[];
}

interface CombinedAnalysis {
  score: number;
  decision: 'Strong Hire' | 'Hire' | 'Weak' | 'Reject';
  top_strength: string;
  top_weakness: string;
  red_flag: boolean;
  summary: string;
  notes: InterviewNotes;
}

// Single structured schema: scoring + detailed notes in one call
const combinedSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.INTEGER, description: 'Candidate score from 0-100' },
    decision: { type: SchemaType.STRING, format: 'enum', enum: ['Strong Hire', 'Hire', 'Weak', 'Reject'], description: 'Hiring decision' },
    top_strength: { type: SchemaType.STRING, description: 'Top strength in max 10 words' },
    top_weakness: { type: SchemaType.STRING, description: 'Top weakness in max 10 words' },
    red_flag: { type: SchemaType.BOOLEAN, description: 'True if candidate lied, was evasive, or completely disengaged' },
    summary: { type: SchemaType.STRING, description: 'Max 2 sentence summary' },
    notes: {
      type: SchemaType.OBJECT,
      description: 'Detailed interview notes for the hiring team',
      properties: {
        overallImpression: { type: SchemaType.STRING, description: '2-3 sentence overall impression of the candidate' },
        strengths: {
          type: SchemaType.ARRAY,
          description: '3-5 key strengths demonstrated during the interview',
          items: { type: SchemaType.STRING },
        },
        concerns: {
          type: SchemaType.ARRAY,
          description: '2-4 concerns or areas of weakness',
          items: { type: SchemaType.STRING },
        },
        keyMoments: {
          type: SchemaType.ARRAY,
          description: '3-5 notable moments from the interview',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              moment: { type: SchemaType.STRING, description: 'Brief description of the notable moment' },
              significance: { type: SchemaType.STRING, format: 'enum', enum: ['positive', 'negative', 'neutral'], description: 'Whether this moment was positive, negative, or neutral' },
            },
            required: ['moment', 'significance'],
          },
        },
        technicalAssessment: { type: SchemaType.STRING, nullable: true, description: 'Assessment of technical ability if applicable, null if not a technical interview' },
        cultureFit: { type: SchemaType.STRING, description: 'Assessment of personality, communication style, and culture fit' },
        recommendation: { type: SchemaType.STRING, description: 'Clear hiring recommendation with reasoning in 1-2 sentences. MUST align with the score and decision above.' },
        followUpQuestions: {
          type: SchemaType.ARRAY,
          description: '2-3 questions to explore in the next round or reference check',
          items: { type: SchemaType.STRING },
        },
      },
      required: ['overallImpression', 'strengths', 'concerns', 'keyMoments', 'cultureFit', 'recommendation', 'followUpQuestions'],
    },
  },
  required: ['score', 'decision', 'top_strength', 'top_weakness', 'red_flag', 'summary', 'notes'],
};

export async function POST(request: Request) {
  try {
    const { candidateId, transcript } = await request.json();

    if (!candidateId || !transcript) {
      return NextResponse.json(
        { error: 'Missing candidateId or transcript' },
        { status: 400 }
      );
    }

    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Fetch candidate data
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('job_id, resume_text, full_name')
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
      console.error('Failed to fetch candidate:', candidateError);
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Step 2: Fetch job details
    let jobTitle = 'Unknown Position';
    let jobDescription = '';

    if (candidate.job_id) {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('title, description')
        .eq('id', candidate.job_id)
        .single();

      if (!jobError && job) {
        jobTitle = job.title || 'Unknown Position';
        jobDescription = job.description || '';
      }
    }

    // Step 3: Initialize Gemini with combined structured output
    const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!googleApiKey) {
      console.error('Missing Google API key');
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: combinedSchema,
      },
    });

    // Prepare resume excerpt (first 500 chars)
    const resumeExcerpt = candidate.resume_text
      ? candidate.resume_text.substring(0, 500)
      : 'No resume provided';

    // Format transcript if it's an array
    const transcriptText = Array.isArray(transcript)
      ? transcript.join('\n')
      : transcript;

    // Guard: reject scoring if no candidate responses in transcript
    const hasCandidateResponses = transcriptText.includes('(Candidate):');
    if (!hasCandidateResponses) {
      // Save transcript but don't advance status — candidate can retake
      await supabase
        .from('candidates')
        .update({
          interview_transcript: transcriptText,
          ai_summary: 'Interview incomplete — no candidate responses recorded. Candidate can retake.',
        })
        .eq('id', candidateId);

      return NextResponse.json({
        success: true,
        incomplete: true,
        analysis: {
          score: 0,
          decision: 'Reject',
          top_strength: 'N/A',
          top_weakness: 'Interview incomplete',
          red_flag: true,
          summary: 'Interview incomplete — no candidate responses were recorded.',
        },
      });
    }

    // Guard: reject scoring if candidate responses are too short (suspicious/empty interview)
    const candidateResponses = transcriptText.split('(Candidate):').slice(1);
    const candidateWords = candidateResponses
      .map((r: string) => {
        // Extract text up to the next speaker marker or end
        const endIdx = r.search(/\(Serena\):|\(Nova\):|\(Wayne\):|\(Atlas\):|\(Interviewer\):/);
        return endIdx > -1 ? r.substring(0, endIdx) : r;
      })
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter((w: string) => w.length > 0);

    if (candidateWords.length < 15) {
      console.log(`[End Interview] Suspicious transcript for ${candidate.full_name} (${candidateId}): only ${candidateWords.length} candidate words`);
      // Save transcript but don't advance status — candidate can retake
      await supabase
        .from('candidates')
        .update({
          interview_transcript: transcriptText,
          ai_summary: `Interview suspicious — only ${candidateWords.length} words from candidate. Possible technical issue. Candidate can retake.`,
        })
        .eq('id', candidateId);

      return NextResponse.json({
        success: true,
        incomplete: true,
        analysis: {
          score: 0,
          decision: 'Reject',
          top_strength: 'N/A',
          top_weakness: 'Insufficient responses',
          red_flag: true,
          summary: `Interview suspicious — only ${candidateWords.length} words from candidate. Status unchanged so candidate can retake.`,
        },
      });
    }

    // Step 4: Fetch configurable prompt from DB (fall back to hardcoded default)
    const FALLBACK_ROUND_1_PROMPT = `You are a senior talent evaluator producing BOTH a score and detailed interview notes for a Round 1 personality and drive interview. This round does NOT test technical skills — it tests hunger, resilience, and ownership mindset.

CRITICAL: Your score, decision, and notes MUST be fully consistent. If you score below 70, your recommendation in the notes must NOT suggest proceeding. If you score 80+, your notes should reflect genuine enthusiasm. There must be ZERO contradiction between the numeric score and the written assessment.

STT NOTICE — SPEECH-TO-TEXT TRANSCRIPTION ERRORS:
This transcript was generated by an automated Speech-to-Text system. Phonetic transcription errors are expected and are NOT the candidate's fault.
- Do NOT penalise mispronunciation or misspelling of interviewer names (e.g. "Ben" or "Vin" is a likely mis-transcription of "Wayne").
- Do NOT penalise phonetically similar substitutions of technical terms (e.g. "drag" is a likely mis-transcription of "RAG").
- Evaluate the candidate on their intent, substance, and ideas — not on the exact words in the transcript.
- If a word looks like a plausible STT error, give the candidate the benefit of the doubt.

CANDIDATE: {candidate_name}
JOB TITLE: {job_title}
JOB DESCRIPTION: {job_description}
RESUME HIGHLIGHTS: {resume_excerpt}

TRANSCRIPT:
{transcript}

SCORING CRITERIA (what this round actually tested):
1. Internal Locus of Control — Do they own their failures or blame others?
2. Permissionless Action — Do they solve problems without being asked, or wait for instructions?
3. High Standards — Do they obsess over quality and hate mediocrity?
4. Drive & Resilience — Do they push through setbacks or give up easily?
5. Communication — Are they articulate, specific, and honest? Or vague and evasive?

SOFT SKILLS EVALUATION (weight these equally with the criteria above):
6. Entrepreneurship — Have they built anything from scratch, shown business-minded thinking, or taken ownership like a founder?
7. Resourcefulness — When they lacked resources, tools, or support, did they find creative workarounds or just complain?
8. Drive & Ambition — Do they have a clear vision for their career? What's the hardest thing they pushed through?
9. Proactiveness & Ownership — Did they fix problems that weren't their job? Do they spot issues before being told?
10. Collaboration & Communication — Can they navigate disagreements, explain complex ideas simply, and lift others up?

SCORING GUIDE:
- 80-100: Clear A-player. Owns failures, acts without permission, gives specific examples, high standards. Shows entrepreneurial thinking, resourcefulness, and genuine ambition.
- 60-79: Solid candidate. Shows some drive but may be vague in places or lack standout moments. Decent soft skills but no exceptional examples.
- 40-59: Mediocre. Generic answers, blames circumstances, waits for instructions, no fire. Soft skills are surface-level with no concrete examples.
- 0-39: Red flags. Evasive, entitled, excuse-maker, or disengaged. No evidence of entrepreneurship, ownership, or collaboration.

NOTES INSTRUCTIONS:
- Be specific — reference actual things the candidate said, not generic observations.
- Be balanced — note both strengths and concerns honestly.
- Key moments should cite specific quotes or exchanges that reveal something important.
- The recommendation MUST align with your score and decision — do not contradict yourself.
- Follow-up questions should target gaps or areas that need deeper exploration in Round 2.
- For technicalAssessment: set to null since this is a personality round, not technical.`;

    let promptTemplate = FALLBACK_ROUND_1_PROMPT;
    try {
      const { data: dbPrompt } = await supabase
        .from('prompts')
        .select('system_prompt')
        .eq('name', 'round_1_scoring')
        .single();
      if (dbPrompt?.system_prompt) {
        promptTemplate = dbPrompt.system_prompt;
      }
    } catch (e) {
      console.warn('[End Interview] Failed to fetch prompt from DB, using fallback:', e);
    }

    const prompt = promptTemplate
      .replace(/\{candidate_name\}/g, candidate.full_name || 'Unknown')
      .replace(/\{job_title\}/g, jobTitle)
      .replace(/\{job_description\}/g, jobDescription)
      .replace(/\{resume_excerpt\}/g, resumeExcerpt)
      .replace(/\{transcript\}/g, transcriptText);

    const result = await model.generateContent(prompt);
    const analysis: CombinedAnalysis = JSON.parse(result.response.text());

    // Step 5: Save everything to database in one update
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        interview_transcript: transcriptText,
        rating: analysis.score,
        ai_summary: analysis.summary,
        interview_notes: analysis.notes,
        status: 'INTERVIEWED',
        round_1_completed_at: new Date().toISOString(),
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('Failed to update candidate:', updateError);
      return NextResponse.json(
        { error: 'Failed to save interview data' },
        { status: 500 }
      );
    }

    // Check if recording was stored for this candidate
    const { data: recCheck } = await supabase
      .from('candidates')
      .select('video_url')
      .eq('id', candidateId)
      .single();
    console.log(`[End Interview] Recording stored for ${candidate.full_name} (${candidateId}): ${recCheck?.video_url ? 'YES' : 'NO — video_url is null'}`);

    console.log(`[End Interview] ${candidate.full_name} (${candidateId}) scored ${analysis.score}/100 - ${analysis.decision}`);

    // Step 6: If score qualifies, generate dossier now and schedule Round 2 invite for next day 10 AM UTC
    // The delayed send gives the impression of human review before advancing candidates.
    if (analysis.score >= 50 && (analysis.decision === 'Strong Hire' || analysis.decision === 'Hire')) {
      console.log(`[End Interview] ${candidate.full_name} (${candidateId}) qualified for Round 2 (score: ${analysis.score}, decision: ${analysis.decision})`);

      // Generate dossier immediately while transcript is fresh
      try {
        const dossierResult = await generateDossier(String(candidateId));
        if (dossierResult.success) {
          console.log(`[End Interview] Generated ${dossierResult.dossier?.length || 0} probe questions for ${candidate.full_name} (${candidateId})`);
        } else {
          console.warn(`[End Interview] Dossier generation failed for ${candidate.full_name} (${candidateId}): ${dossierResult.error}`);
        }
      } catch (err) {
        console.error(`[End Interview] Dossier error for ${candidate.full_name} (${candidateId}):`, err);
      }

      // Schedule Round 2 invite for next day at 10 AM UTC (simulates human review delay)
      const now = new Date();
      const nextDay10AM = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        10, 0, 0, 0
      ));

      const { error: scheduleError } = await supabase
        .from('candidates')
        .update({
          status: 'ROUND_2_APPROVED',
          round_2_invite_after: nextDay10AM.toISOString(),
        })
        .eq('id', candidateId);

      if (scheduleError) {
        console.error(`[End Interview] Failed to schedule Round 2 invite for ${candidate.full_name} (${candidateId}):`, scheduleError);
      } else {
        console.log(`[End Interview] Round 2 invite scheduled for ${candidate.full_name} (${candidateId}) at ${nextDay10AM.toISOString()}`);
      }
    } else {
      console.log(`[End Interview] ${candidate.full_name} (${candidateId}) not eligible for Round 2 (score: ${analysis.score}, decision: ${analysis.decision})`);
    }

    // Step 7: Return success with analysis (without notes — client doesn't need them)
    return NextResponse.json({
      success: true,
      analysis: {
        score: analysis.score,
        decision: analysis.decision,
        top_strength: analysis.top_strength,
        top_weakness: analysis.top_weakness,
        red_flag: analysis.red_flag,
        summary: analysis.summary,
      },
    });

  } catch (error) {
    console.error('End interview error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
