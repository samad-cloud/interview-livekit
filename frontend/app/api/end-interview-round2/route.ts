import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateInterviewNotes } from '@/app/actions/generateNotes';
import { generateFinalVerdict } from '@/app/actions/generateFinalVerdict';

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

    // Format transcript if it's an array
    const transcriptText = Array.isArray(transcript)
      ? transcript.join('\n')
      : transcript;

    // Fetch candidate data for notes generation
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('full_name, job_id, interview_transcript')
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
      console.error('Failed to fetch candidate:', candidateError);
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Fetch job title
    let jobTitle = 'Unknown Position';
    if (candidate.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', candidate.job_id)
        .single();
      if (job) jobTitle = job.title || 'Unknown Position';
    }

    // Guard: check for missing or suspicious candidate responses
    const hasCandidateResponses = transcriptText.includes('(Candidate):');
    if (!hasCandidateResponses) {
      // Save transcript but don't advance — candidate can retake
      await supabase
        .from('candidates')
        .update({ round_2_transcript: transcriptText })
        .eq('id', candidateId);

      console.log(`[End Interview Round 2] Incomplete transcript for ${candidate.full_name} (${candidateId}): no candidate responses`);
      return NextResponse.json({
        success: true,
        incomplete: true,
        message: 'Interview incomplete — no candidate responses recorded. Candidate can retake.',
      });
    }

    // Guard: check if candidate responses are too short (suspicious)
    const candidateResponses = transcriptText.split('(Candidate):').slice(1);
    const candidateWords = candidateResponses
      .map((r: string) => {
        const endIdx = r.search(/\(Serena\):|\(Nova\):|\(Wayne\):|\(Atlas\):|\(Interviewer\):/);
        return endIdx > -1 ? r.substring(0, endIdx) : r;
      })
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter((w: string) => w.length > 0);

    if (candidateWords.length < 15) {
      // Save transcript but don't trigger notes or advance status
      await supabase
        .from('candidates')
        .update({ round_2_transcript: transcriptText })
        .eq('id', candidateId);

      console.log(`[End Interview Round 2] Suspicious transcript for ${candidate.full_name} (${candidateId}): only ${candidateWords.length} candidate words`);
      return NextResponse.json({
        success: true,
        incomplete: true,
        message: `Interview suspicious — only ${candidateWords.length} words from candidate. Candidate can retake.`,
      });
    }

    // Save Round 2 transcript to database
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        round_2_transcript: transcriptText,
        round_2_completed_at: new Date().toISOString(),
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('Failed to update candidate:', updateError);
      return NextResponse.json(
        { error: 'Failed to save Round 2 transcript' },
        { status: 500 }
      );
    }

    console.log(`[End Interview Round 2] Saved transcript for ${candidate.full_name} (${candidateId})`);

    // Check if recording was stored for this candidate
    const { data: recCheck } = await supabase
      .from('candidates')
      .select('round_2_video_url')
      .eq('id', candidateId)
      .single();
    console.log(`[End Interview Round 2] Recording stored for ${candidate.full_name} (${candidateId}): ${recCheck?.round_2_video_url ? 'YES — ' + recCheck.round_2_video_url : 'NO — round_2_video_url is null'}`);

    // Generate final verdict — scores R2, updates round_2_rating, status, and current_stage
    let verdictResult = null;
    try {
      verdictResult = await generateFinalVerdict(String(candidateId));
      if (verdictResult.success) {
        console.log(`[End Interview Round 2] Final verdict for ${candidate.full_name} (${candidateId}): ${verdictResult.verdict?.verdict} (Score: ${verdictResult.verdict?.score}/100)`);
      } else {
        console.error(`[End Interview Round 2] Verdict generation failed for ${candidate.full_name} (${candidateId}): ${verdictResult.error}`);
      }
    } catch (err) {
      console.error(`[End Interview Round 2] Verdict error for ${candidate.full_name} (${candidateId}):`, err);
    }

    // Auto-generate interview notes with both transcripts (fire-and-forget)
    generateInterviewNotes({
      candidateId,
      candidateName: candidate.full_name || 'Unknown',
      jobTitle,
      round1Transcript: candidate.interview_transcript || null,
      round2Transcript: transcriptText,
    }).then(() => {
      console.log(`[End Interview Round 2] Auto-generated notes for ${candidate.full_name} (${candidateId})`);
    }).catch((err) => {
      console.error(`[End Interview Round 2] Failed to auto-generate notes for ${candidate.full_name} (${candidateId}):`, err);
    });

    return NextResponse.json({
      success: true,
      verdict: verdictResult?.success ? verdictResult.verdict : undefined,
    });

  } catch (error) {
    console.error('End interview round 2 error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
