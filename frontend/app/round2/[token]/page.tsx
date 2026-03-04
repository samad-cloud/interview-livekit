'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import VoiceAvatar from '@/components/VoiceAvatar';
import { Loader2, AlertCircle, CheckCircle, Lock, Monitor } from 'lucide-react';

interface CandidateData {
  id: number;
  full_name: string;
  job_id: number | null;
  job_description: string | null;
  resume_text: string | null;
  status: string;
  current_stage: string | null;
  round_1_dossier: string | string[] | null;
  round_2_rating: number | null;
}

// Detect mobile devices — survives Chrome's "Request Desktop Site" mode.
// UA alone is not enough: desktop mode swaps the UA string to look like desktop Chrome.
// maxTouchPoints and screen.width reflect actual hardware and are never spoofed.
function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch = navigator.maxTouchPoints > 1;
  const isSmallScreen = screen.width < 768;
  const hasMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return (hasTouch && isSmallScreen) || hasMobileUA;
}

export default function Round2Page() {
  const params = useParams();
  const token = params.token as string;

  // Synchronous init — no flash, blocks before anything else renders
  const [isMobile] = useState<boolean>(() => detectMobile());
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [jobTitle, setJobTitle] = useState<string>('Open Position');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading technical interview...');
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const fetchCandidate = async () => {
      if (!token) {
        setError('No interview token provided');
        setIsLoading(false);
        return;
      }

      const MAX_ATTEMPTS = 3;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          if (attempt > 1) {
            setLoadingMessage(`Connecting... (attempt ${attempt} of ${MAX_ATTEMPTS})`);
          }

          const { data, error: supabaseError } = await supabase
            .from('candidates')
            .select('id, full_name, job_id, job_description, resume_text, status, current_stage, round_1_dossier, round_2_rating')
            .eq('interview_token', token)
            .single();

          if (supabaseError) {
            // PGRST116 = 0 rows — token genuinely doesn't exist, never retry
            if (supabaseError.code === 'PGRST116') {
              setError('Interview link is invalid or expired');
              setIsLoading(false);
              return;
            }
            // Any other Supabase/network error — allow retry
            throw new Error(supabaseError.message);
          }

          if (!data) {
            setError('Candidate not found');
            setIsLoading(false);
            return;
          }

          // Check if candidate is in Round 2 stage
          // Allow access if current_stage is 'round_2' OR status indicates R2 invitation
          if (data.current_stage !== 'round_2' && data.status !== 'ROUND_2_INVITED' && data.status !== 'ROUND_2_APPROVED') {
            setAccessDenied(true);
            setIsLoading(false);
            return;
          }

          setCandidate(data);

          // Fetch job title — best-effort, single attempt (non-critical)
          if (data.job_id) {
            const { data: job } = await supabase
              .from('jobs')
              .select('title')
              .eq('id', data.job_id)
              .single();
            if (job?.title) setJobTitle(job.title);
          }

          setIsLoading(false);
          return; // success — exit retry loop

        } catch {
          if (attempt < MAX_ATTEMPTS) {
            // Exponential backoff: 1s then 2s before next attempt
            await new Promise(r => setTimeout(r, 1000 * attempt));
          } else {
            setError('Unable to connect. Please check your internet connection and try refreshing the page.');
            setIsLoading(false);
          }
        }
      }
    };

    fetchCandidate();
  }, [token]);

  // Mobile Block — shown before anything else, no data fetch needed
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm mx-auto">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Monitor className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Desktop Required
          </h1>
          <p className="text-muted-foreground mb-3">
            This interview must be completed on a laptop or desktop computer.
          </p>
          <p className="text-muted-foreground/60 text-sm">
            Please open your interview link in a desktop browser to continue.
          </p>
        </div>
      </div>
    );
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-foreground text-lg">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Access Denied - Not in Round 2 stage
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Round 2 Not Available
          </h1>
          <p className="text-muted-foreground mb-6">
            You need to complete Round 1 first, or wait for HR to invite you to Round 2.
          </p>
          <a
            href="https://printerpix.com"
            className="inline-block px-6 py-3 bg-card hover:bg-muted border border-border text-foreground rounded-lg transition-colors"
          >
            Return to Printerpix
          </a>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !candidate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Interview Link Invalid
          </h1>
          <p className="text-muted-foreground mb-6">
            {error || 'This interview link is no longer valid. Please contact the recruiter for a new link.'}
          </p>
          <a
            href="https://printerpix.com"
            className="inline-block px-6 py-3 bg-card hover:bg-muted border border-border text-foreground rounded-lg transition-colors"
          >
            Return to Printerpix
          </a>
        </div>
      </div>
    );
  }

  // Already Completed Round 2 - Prevent re-taking
  if (candidate.round_2_rating !== null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card rounded-2xl p-10 max-w-md mx-auto text-center shadow-xl border border-border">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            All Rounds Complete
          </h1>
          <p className="text-muted-foreground mb-2">
            Thank you, {candidate.full_name}.
          </p>
          <p className="text-muted-foreground/70 text-sm">
            Both interview rounds have been completed. Our hiring team will review your performance and be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  // Parse dossier: DB column is text type containing a JSON array string
  let parsedDossier: string[] | undefined;
  if (candidate.round_1_dossier) {
    if (Array.isArray(candidate.round_1_dossier)) {
      parsedDossier = candidate.round_1_dossier;
    } else {
      try {
        const parsed = JSON.parse(candidate.round_1_dossier);
        parsedDossier = Array.isArray(parsed) ? parsed : undefined;
      } catch {
        parsedDossier = undefined;
      }
    }
  }

  // Success - Render Round 2 Voice Interview with Nova persona
  return (
    <VoiceAvatar
      candidateId={String(candidate.id)}
      candidateName={candidate.full_name}
      jobTitle={jobTitle}
      jobDescription={candidate.job_description || 'Software Engineer at Printerpix'}
      resumeText={candidate.resume_text || 'No resume provided'}
      round={2}
      dossier={parsedDossier}
    />
  );
}
