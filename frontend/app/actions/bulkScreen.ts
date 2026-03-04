'use server';

import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

interface ScreeningResult {
  success: boolean;
  name?: string;
  email?: string;
  score?: number;
  reasoning?: string;
  status?: 'RECOMMENDED' | 'REJECT';
  error?: string;
  skipped?: boolean;
}

const screeningSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING, description: 'Full name extracted from resume' },
    email: { type: SchemaType.STRING, description: 'Email extracted from resume' },
    resume_text: { type: SchemaType.STRING, description: 'Full extracted resume text' },
    score: { type: SchemaType.INTEGER, description: 'Match score 0-100' },
    reasoning: { type: SchemaType.STRING, description: 'One sentence explanation of score' },
    status: { type: SchemaType.STRING, format: 'enum', enum: ['RECOMMENDED', 'REJECT'], description: 'RECOMMENDED if score >= 70, otherwise REJECT' },
  },
  required: ['name', 'email', 'resume_text', 'score', 'reasoning', 'status'],
};

export async function screenResume(jobId: string, fileData: FormData): Promise<ScreeningResult> {
  try {
    // Get the file from FormData
    const file = fileData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: 'Supabase not configured' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch job description
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('title, description')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return { success: false, error: 'Job not found' };
    }

    // Initialize Gemini with structured output
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'AI service not configured' };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: screeningSchema,
      },
    });

    // Convert file to base64 for Gemini
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Parse and grade the resume with Gemini
    const prompt = `You are an Expert Technical Recruiter. Analyze this resume PDF against the job description.

JOB TITLE: ${job.title}
JOB DESCRIPTION:
${job.description?.substring(0, 2000) || 'Software Engineering Role'}

TASKS:
1. Extract the candidate's Full Name from the resume.
2. Extract the candidate's Email from the resume.
3. Extract the full text content of the resume.
4. Calculate a Match Score (0-100) based strictly on how well they match the job requirements.
   - 80-100: Exceptional match (has all required skills + experience level)
   - 60-79: Good match (has most requirements)
   - 40-59: Partial match (missing key requirements)
   - 0-39: Poor match (significantly underqualified)
5. Write a 1-sentence reasoning explaining the score.
6. Set status: "RECOMMENDED" if score >= 70, otherwise "REJECT".

CONTEXT: We are looking for 'Go-Getters' and high achievers. Be strict.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64,
        },
      },
      prompt,
    ]);

    const parsed: {
      name: string;
      email: string;
      resume_text: string;
      score: number;
      reasoning: string;
      status: 'RECOMMENDED' | 'REJECT';
    } = JSON.parse(result.response.text());

    // Check for duplicate email
    if (parsed.email) {
      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', parsed.email.toLowerCase())
        .single();

      if (existing) {
        return {
          success: true,
          skipped: true,
          name: parsed.name,
          email: parsed.email,
          score: parsed.score,
          reasoning: 'Duplicate - candidate already exists',
          status: 'REJECT',
        };
      }
    }

    // Determine status based on score
    const status = parsed.score >= 70 ? 'RECOMMENDED' : 'REJECT';
    const dbStatus = parsed.score >= 70 ? 'GRADED' : 'CV_REJECTED';

    // Save to database
    const { error: insertError } = await supabase.from('candidates').insert({
      full_name: parsed.name || 'Unknown',
      email: parsed.email?.toLowerCase() || `unknown-${Date.now()}@bulk-upload.local`,
      resume_text: parsed.resume_text || '',
      jd_match_score: parsed.score,
      job_id: jobId,
      job_description: job.description,
      status: dbStatus,
      metadata: {
        source: 'bulk_upload',
        grading_reasoning: parsed.reasoning,
        uploaded_file: file.name,
      },
    });

    if (insertError) {
      console.error('Failed to insert candidate:', insertError);
      return { success: false, error: 'Failed to save candidate' };
    }

    return {
      success: true,
      name: parsed.name,
      email: parsed.email,
      score: parsed.score,
      reasoning: parsed.reasoning,
      status,
    };
  } catch (error) {
    console.error('Screen resume error:', error);
    return { success: false, error: 'Failed to process resume' };
  }
}
