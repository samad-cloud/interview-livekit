'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, CameraOff, Loader2, Volume2, AlertCircle, Clock, Monitor, X } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

// ── IndexedDB helpers for chunked recording ──────────────────────────────────
const IDB_NAME  = 'interview-recording-chunks';
const IDB_STORE = 'chunks';

function openChunkDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE, { autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function idbSaveChunk(db: IDBDatabase, chunk: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).add(chunk);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
function idbGetAllChunks(db: IDBDatabase): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result as Blob[]);
    req.onerror   = () => reject(req.error);
  });
}
function idbClearChunks(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
// ─────────────────────────────────────────────────────────────────────────────

interface VoiceAvatarProps {
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  round?: 1 | 2;
  dossier?: string[];
}

// Conversation tracking types
interface ConversationEntry {
  role: 'interviewer' | 'candidate';
  speaker: string;
  text: string;
  timestamp: Date;
}

type CallStatus = 'idle' | 'connecting' | 'active' | 'analyzing' | 'ended';

export default function VoiceAvatar({
  candidateId,
  candidateName,
  jobTitle,
  jobDescription,
  resumeText,
  round = 1,
  dossier,
}: VoiceAvatarProps) {
  // Call state
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const callStatusRef = useRef<CallStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Media state
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Media check state
  const [mediaCheckDone, setMediaCheckDone] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [micError, setMicError] = useState(false);

  // Deepgram STT state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // Subtitle state (what the AI is saying)
  const [subtitle, setSubtitle] = useState('');

  // Refs
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const checkVideoRef = useRef<HTMLVideoElement>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const checkAudioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const finalTranscriptRef = useRef('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Conversation history for transcript
  const conversationHistoryRef = useRef<ConversationEntry[]>([]);

  // Refs to break stale closures in async callbacks
  const isMicOnRef = useRef(isMicOn);
  const isSpeakingRef = useRef(isSpeaking);
  const speakCancelledRef = useRef(false);
  const sendToAIRef = useRef<((text: string) => Promise<void>) | null>(null);
  const startDeepgramListeningRef = useRef<(() => Promise<void>) | null>(null);

  // Session recording refs (native MediaRecorder + IndexedDB chunks)
  const recAudioCtxRef = useRef<AudioContext | null>(null);
  const recDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recMicSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkDBRef = useRef<IDBDatabase | null>(null);
  const isRecordingRef = useRef(false);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const chunkIndexRef = useRef(0);
  const pendingChunkUploadsRef = useRef<Promise<void>[]>([]);
  const recordingMimeTypeRef = useRef<string>('video/webm');

  // In-flight welcome audio promises (started on mount, awaited at interview start)
  const welcomeAudioPromisesRef = useRef<Promise<Blob>[] | null>(null);

  // Interviewer prompt templates fetched from DB (fetched once on mount)
  const [promptTemplates, setPromptTemplates] = useState<Record<string, string>>({});
  // Locked system prompt — set once when templates load (or immediately from fallback)
  const systemPromptRef = useRef<string>('');

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Submitting guard — prevents browser close during upload
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Exit confirmation modal
  const [showExitModal, setShowExitModal] = useState(false);

  // Silence detection for "Done Speaking" nudge
  const [showDoneHint, setShowDoneHint] = useState(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Interview timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isWrappingUp, setIsWrappingUp] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endInterviewRef = useRef<(() => Promise<void>) | null>(null);

  // Helper: substitute {placeholder} variables in a prompt template
  function interpolatePrompt(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
      (result, [key, value]) => result.replaceAll(`{${key}}`, value),
      template
    );
  }

  // Round 1 (Serena) - Personality/Drive assessment
  const dossierQuestions = dossier?.map((q, i) => `${i + 1}. ${q}`).join('\n') || 'No specific questions prepared.';

  const vars = {
    candidateName,
    jobDescription,
    resumeText: resumeText?.substring(0, 1000) || 'No resume provided.',
    dossierQuestions,
  };

  // Fallback hardcoded prompts (used if DB fetch hasn't completed or failed)
  const fallbackRound1Prompt = `=== YOUR IDENTITY ===
  NAME: Serena
  ROLE: Elite Talent Scout at Printerpix.
  VIBE: You are warm but incredibly sharp. You are NOT checking boxes. You are hunting for "A-Players" (top 1% talent).
  GOAL: Determine if ${candidateName} has "The Hunger" (drive, resilience, ownership) or if they are just looking for a paycheck.

  === THE CANDIDATE ===
  NAME: ${candidateName}
  JOB: ${jobDescription}

  === CANDIDATE'S RESUME ===
  ${resumeText?.substring(0, 1000) || 'No resume provided.'}

  === YOUR PSYCHOLOGICAL RADAR (WHAT YOU ARE LOOKING FOR) ===
  1. **Internal Locus of Control:** Do they own their failures? Or do they blame "the system," "the manager," or "bad luck"? (Reject excuse-makers).
  2. **Permissionless Action:** Do they wait for instructions, or do they find solutions? Ask for examples of them solving problems without being asked.
  3. **High Standards:** Do they obsess over quality? Do they hate mediocrity?

  === SOFT SKILLS SEGMENT (LAST 5 MINUTES OF THE INTERVIEW) ===
  In the FINAL 5 minutes of the interview (around the 15-minute mark), transition into evaluating these five soft skills. Transition naturally — do NOT announce "now we're doing the soft skills portion." A good bridge: "Before we wrap up, I'd love to understand a bit more about how you work..."

  1. **Entrepreneurship:** Have they ever built something from scratch, started a side project, or taken a business-minded approach to a problem? Do they think like an owner or an employee?
  2. **Resourcefulness:** When they lacked tools, budget, or support — what did they do? Did they find creative workarounds or just complain?
  3. **Drive & Ambition:** What are they working toward? Do they have a vision for their career, or are they just drifting? What's the hardest thing they've pushed through?
  4. **Proactiveness & Ownership:** Do they wait to be told what to do, or do they spot problems and fix them? Ask for a specific example of something they did that was NOT part of their job description.
  5. **Collaboration & Communication:** How do they handle disagreements with teammates? Can they explain a complex idea simply? Do they lift others up or work in isolation?

  Get SPECIFIC EXAMPLES for each. Vague answers like "I'm a team player" are not acceptable — push for the story behind the claim.

  === INTERVIEW RULES (HUMAN MODE) ===
  1. **No Robot Lists:** Do NOT ask "Can you tell me about a time..." like a script.
  2. **The "Bridge":** Always acknowledge their last answer before pivoting.
     - *Bad:* "Okay. Next question."
     - *Good:* "That sounds incredibly stressful. I'm curious—when that plan fell apart, did you try to fix it yourself or did you escalate it?"
  3. **Dig Deep:** If they give a vague answer ("I worked hard"), PUSH BACK gently.
     - Say: "Give me the specific numbers. How much money did that actually save?"
  4. **The "Excellence" Test:** Ask questions that reveal if they are a "dead beat" or a "winner."
  5. **NEVER PRETEND TO BE THE CANDIDATE:** You are Serena the interviewer. NEVER say "I have experience in..." or describe YOUR work history. You have no background to share. The resume above is THEIR experience, not yours.

  === INTERVIEW DURATION ===
  This interview lasts 20 minutes. You will be told how much time has elapsed.
  When time is running low (around 18 minutes), wrap up using the EXACT closing script below. Do NOT improvise your own ending.

  === CLOSING SCRIPT (USE THIS EXACTLY WHEN ENDING) ===
  When it's time to end, say EXACTLY this word for word — do NOT paraphrase, do NOT personalize, do NOT skip any part:
  "${candidateName}, I've really enjoyed our conversation today. Thank you for being so open and sharing your experiences with me. Our team will review everything and be in touch with next steps soon. I wish you the best of luck — take care! [END_INTERVIEW]"
  You MUST include [END_INTERVIEW] at the very end. Do NOT add anything after it.

  === REMEMBER ===
  You are Serena. You ASK questions. You do NOT answer questions about yourself.
  The candidate is ${candidateName}. They ANSWER your questions.`;

  const fallbackRound2Prompt = `=== YOUR IDENTITY ===
  NAME: Nova
  ROLE: Senior Technical Architect at Printerpix.
  VIBE: You are professional, direct, and technical. You respect competence and have zero tolerance for BS or buzzwords.
  GOAL: Verify that ${candidateName} actually has the technical depth they claimed in their first interview.

  === THE CANDIDATE ===
  NAME: ${candidateName}
  JOB: ${jobDescription}

  === CONTEXT ===
  This candidate passed Round 1 (personality/drive assessment with Serena). Now YOU need to verify their technical claims AND dig deeper into their soft skills.

  === TECHNICAL PROBE QUESTIONS (FROM ROUND 1 ANALYSIS) ===
  These are specific technical claims they made. Dig into each one:
  ${dossierQuestions}

  === SOFT SKILLS DEEP DIVE (LAST 5 MINUTES OF THE INTERVIEW) ===
  In the FINAL 5 minutes of the interview (around the 35-minute mark), transition into a soft skills deep dive. In Round 1, the candidate was assessed on these same areas by Serena. Your job is to DIG DEEPER — verify consistency with their Round 1 answers and get richer, more specific examples. Transition naturally — e.g., "Shifting gears a bit before we close out — I want to revisit some things from your first conversation..."

  1. **Entrepreneurship:** In Round 1 they may have described projects or initiatives. Push deeper — what was the business outcome? Did they measure ROI? Would they do it differently now?
  2. **Resourcefulness:** Ask about a time they were stuck technically AND organizationally. How did they unblock themselves without waiting for help?
  3. **Drive & Ambition:** What's the most ambitious technical challenge they've taken on? Not just "hard" — ambitious. What made them pursue it?
  4. **Proactiveness & Ownership:** Ask for an example of a production incident, tech debt, or process gap they fixed without being asked. What happened AFTER they fixed it?
  5. **Collaboration & Communication:** How do they handle code review disagreements? Have they ever had to convince a team to adopt a different approach? How did they do it?

  Look for CONSISTENCY with what they told Serena in Round 1. If their stories contradict or change, note it. If they go deeper and reveal more detail, that's a strong signal.

  === INTERVIEW RULES (SHOW ME THE CODE MODE) ===
  1. **Verify, Don't Accept:** If they say "I optimized the database," ask HOW. What indexes? What query plans? What was the before/after latency?
  2. **Follow Up Relentlessly:** If they give a surface-level answer, dig deeper. "Walk me through the exact steps."
  3. **Test Understanding:** Ask them to explain tradeoffs. "Why did you choose X over Y?"
  4. **Expose Gaps:** It's OK to find gaps. Say "Interesting. So you're less experienced with X? That's fine, just want to understand your level."
  5. **NEVER PRETEND TO BE THE CANDIDATE:** You are Nova the interviewer. NEVER describe YOUR work history or experience. Ask THEM questions.

  === INTERVIEW DURATION ===
  This interview lasts 40 minutes. You will be told how much time has elapsed.
  When time is running low (around 38 minutes), wrap up using the EXACT closing script below. Do NOT improvise your own ending.

  === CLOSING SCRIPT (USE THIS EXACTLY WHEN ENDING) ===
  When it's time to end, say something close to this (you may personalize slightly based on the conversation, but keep the structure):
  "${candidateName}, I appreciate you walking me through the technical details today. You've given me a solid picture of your capabilities. Our team will review everything from both rounds and be in touch with next steps. Thanks again for your time — take care! [END_INTERVIEW]"
  You MUST include [END_INTERVIEW] at the very end. Do NOT add anything after it.

  === REMEMBER ===
  You are Nova. You ASK technical questions. You do NOT answer questions about yourself.
  The candidate is ${candidateName}. They ANSWER your questions.`;

  // Lock the system prompt into a ref once DB templates load (or keep fallback if fetch fails).
  // The ref ensures sendToAI always reads the same prompt for the entire interview session.
  useEffect(() => {
    const promptKey = round === 2 ? 'round_2_interviewer' : 'round_1_interviewer';
    const dbTemplate = promptTemplates[promptKey];
    if (dbTemplate) {
      systemPromptRef.current = interpolatePrompt(dbTemplate, vars);
    }
  // Intentionally run only when promptTemplates changes (once after DB fetch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptTemplates]);

  // Initialise ref with fallback on first render so it's never empty
  if (!systemPromptRef.current) {
    systemPromptRef.current = round === 2 ? fallbackRound2Prompt : fallbackRound1Prompt;
  }

  const systemPrompt = systemPromptRef.current;
  const interviewerName = round === 2 ? 'Nova' : 'Serena';

  // Add entry to conversation history
  const addToConversation = useCallback((role: 'interviewer' | 'candidate', text: string) => {
    const entry: ConversationEntry = {
      role,
      speaker: role === 'interviewer' ? interviewerName : candidateName,
      text: text.trim(),
      timestamp: new Date(),
    };
    conversationHistoryRef.current.push(entry);
  }, [candidateName, interviewerName]);

  // Ship a recording chunk to the server for incremental backup + server-side logging
  // Returns a Promise so endInterview can await all in-flight uploads before finalizing
  const uploadChunkToServer = (chunkIndex: number, chunk: Blob): Promise<void> => {
    const formData = new FormData();
    formData.append('candidateId', candidateId);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('round', String(round));
    formData.append('mimeType', recordingMimeTypeRef.current);
    formData.append('chunk', chunk, `chunk_${chunkIndex}.webm`);
    return fetch('/api/save-recording-chunk', { method: 'POST', body: formData })
      .then(() => {})
      .catch(() => {
        // Server chunk upload failed — chunk still in IndexedDB as local backup
      });
  };

  // Initialize session recording using native MediaRecorder + IndexedDB chunk buffering
  const initSessionRecording = useCallback(async () => {
    try {
      // Open IndexedDB and clear any stale chunks from a previous session
      const db = await openChunkDB();
      await idbClearChunks(db);
      chunkDBRef.current = db;
      chunkIndexRef.current = 0;
      pendingChunkUploadsRef.current = [];

      // Create audio context for mixing mic + TTS audio
      const audioCtx = new AudioContext();
      recAudioCtxRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();
      recDestinationRef.current = destination;

      // Connect candidate mic audio into the mix
      if (userStreamRef.current) {
        const audioTracks = userStreamRef.current.getAudioTracks();
        if (audioTracks.length > 0) {
          const micOnlyStream = new MediaStream(audioTracks);
          const micSource = audioCtx.createMediaStreamSource(micOnlyStream);
          micSource.connect(destination);
          recMicSourceRef.current = micSource;
        }
      }

      // Build combined stream: video track (if available) + mixed audio
      const combinedTracks: MediaStreamTrack[] = [];

      const videoTrack = userStreamRef.current?.getVideoTracks()[0];
      if (videoTrack && !cameraError) {
        combinedTracks.push(videoTrack);
      }

      const mixedAudioTrack = destination.stream.getAudioTracks()[0];
      if (mixedAudioTrack) {
        combinedTracks.push(mixedAudioTrack);
      }

      if (combinedTracks.length === 0) return;

      const combinedStream = new MediaStream(combinedTracks);
      const hasVideo = combinedTracks.some(t => t.kind === 'video');
      recordingStreamRef.current = combinedStream;

      // Pick best supported MIME type — must include audio codec alongside video codec
      // so both candidate voice and video are captured in the recording
      const mimeType = hasVideo
        ? (['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4']
            .find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/mp4')
        : (['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4']
            .find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/mp4');

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: hasVideo ? 200_000 : undefined,
        audioBitsPerSecond: 128_000,
      });

      // Each 30s chunk → persisted to IndexedDB + shipped to server for incremental backup
      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          const idx = chunkIndexRef.current++;
          if (chunkDBRef.current) {
            try {
              await idbSaveChunk(chunkDBRef.current, e.data);
            } catch {
              // IndexedDB write failed — chunk lost locally, server copy still being sent
            }
          }
          // Upload to server and track the promise so Phase 2 can await all before finalizing
          pendingChunkUploadsRef.current.push(uploadChunkToServer(idx, e.data));
        }
      };

      sessionMediaRecorderRef.current = recorder;
      recordingMimeTypeRef.current = recorder.mimeType || 'video/webm';
    } catch {
      // Recording init failed — interview proceeds without recording
    }
  }, [cameraError]);

  // Split text into sentence chunks for pipelined TTS playback
  const splitIntoTTSChunks = (text: string): string[] => {
    // Split on sentence-ending punctuation (keep the punctuation)
    const raw = text.match(/[^.!?]+[.!?]+[\s]*/g);
    if (!raw) return [text];

    // Combine short sentences so each chunk is substantial enough
    // to sound natural but small enough to generate quickly
    const chunks: string[] = [];
    let current = '';
    for (const sentence of raw) {
      if (current.length + sentence.length < 180) {
        current += sentence;
      } else {
        if (current.trim()) chunks.push(current.trim());
        current = sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text];
  };

  // Play a single audio blob with recording mixer routing
  const playAudioChunk = useCallback(async (blob: Blob): Promise<void> => {
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    // Route TTS audio into recording mixer (mic + TTS → single track)
    try {
      if (recAudioCtxRef.current && recDestinationRef.current) {
        if (recAudioCtxRef.current.state === 'suspended') {
          await recAudioCtxRef.current.resume();
        }
        const ttsSource = recAudioCtxRef.current.createMediaElementSource(audio);
        ttsSource.connect(recDestinationRef.current); // → recording
        ttsSource.connect(recAudioCtxRef.current.destination); // → speakers
      }
    } catch {
      // TTS audio routing failed — audio still plays through default output
    }

    await new Promise<void>((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.play().catch(() => {
        resolve();
      });
    });
  }, []);

  // Speak text using Deepgram TTS with sentence-chunked pipeline
  // Splits text into sentences, fetches TTS in parallel, plays sequentially.
  // First sentence plays as soon as it's ready — eliminates the long wait.
  const speakText = useCallback(async (text: string) => {
    try {
      isSpeakingRef.current = true;
      speakCancelledRef.current = false;
      setIsSpeaking(true);
      setSubtitle(text);

      // Stop listening while speaking to prevent echo
      if (deepgramSocketRef.current) {
        stopDeepgramListening();
      }

      const chunks = splitIntoTTSChunks(text);

      // Fire all TTS requests in parallel — short chunks generate fast
      const audioPromises = chunks.map(chunk =>
        fetch('/api/deepgram-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk }),
        }).then(r => {
          if (!r.ok) throw new Error('TTS failed');
          return r.blob();
        })
      );

      // Play each chunk sequentially as it resolves
      for (let i = 0; i < audioPromises.length; i++) {
        if (speakCancelledRef.current) break;

        const blob = await audioPromises[i];
        if (speakCancelledRef.current) break;

        await playAudioChunk(blob);
      }

      // Done speaking — reset state and resume listening
      isSpeakingRef.current = false;
      setIsSpeaking(false);

      // Ensure recording AudioContext is active for mic capture during candidate speech
      if (recAudioCtxRef.current && recAudioCtxRef.current.state === 'suspended') {
        recAudioCtxRef.current.resume().catch(() => {});
      }

      if (isMicOnRef.current) {
        startDeepgramListeningRef.current?.();
      }
    } catch {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      // Fallback: use browser TTS
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (isMicOnRef.current) {
          startDeepgramListeningRef.current?.();
        }
      };
      speechSynthesis.speak(utterance);
    }
  }, [playAudioChunk]);

  // Stop Deepgram listening - defined before startDeepgramListening for reference
  const stopDeepgramListening = useCallback(() => {
    // Reset accumulated transcript
    finalTranscriptRef.current = '';

    // Stop MediaRecorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Close WebSocket
    if (deepgramSocketRef.current) {
      deepgramSocketRef.current.close();
      deepgramSocketRef.current = null;
    }

    // Stop audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    setIsListening(false);
    setTranscript('');
  }, []);

  // Send transcript to AI and speak response
  const sendToAI = useCallback(async (text: string) => {
    if (!text.trim() || callStatus !== 'active') return;

    try {
      addToConversation('candidate', text);
      finalTranscriptRef.current = '';
      setTranscript('');
      // Clear silence nudge
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setShowDoneHint(false);

      // Stop listening while processing
      stopDeepgramListening();

      // Call Gemini to generate interviewer response
      const minutesElapsed = Math.floor(elapsedSeconds / 60);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          systemPrompt: systemPrompt,
          history: conversationHistoryRef.current,
          minutesElapsed,
          isWrappingUp,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const { reply } = await response.json();

      // Check if AI wants to end the interview
      const wantsToEnd = reply.includes('[END_INTERVIEW]');
      const cleanReply = reply.replace(/\[END_INTERVIEW\]/g, '').trim();

      // Log interviewer's response and speak it
      addToConversation('interviewer', cleanReply);
      await speakText(cleanReply);

      // After TTS finishes, auto-end if AI signaled
      if (wantsToEnd) {
        endInterviewRef.current?.();
      }
    } catch {
      setError('Failed to get response');
    }
  }, [callStatus, addToConversation, systemPrompt, speakText, stopDeepgramListening, elapsedSeconds, isWrappingUp, candidateName, round]);

  // Start Deepgram listening
  const startDeepgramListening = useCallback(async () => {
    if (isSpeakingRef.current) return; // Don't start if still speaking
    
    try {
      // Get Deepgram API key from our backend
      const response = await fetch('/api/deepgram');
      if (!response.ok) throw new Error('Failed to get Deepgram key');
      const { key } = await response.json();

      // Get audio stream with echo cancellation
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = audioStream;

      // Connect to Deepgram WebSocket with optimized settings
      const socket = new WebSocket(
        'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
          model: 'nova-2',
          smart_format: 'true',
          punctuate: 'true',
          interim_results: 'true',
          endpointing: '300',
          utterance_end_ms: '1000',
          vad_events: 'true',
        }).toString(),
        ['token', key]
      );

      socket.onopen = () => {
        setIsListening(true);

        // Start MediaRecorder — pick best supported audio format (Safari needs mp4/aac)
        const sttMimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4']
          .find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/mp4';
        const mediaRecorder = new MediaRecorder(audioStream, {
          mimeType: sttMimeType,
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        };

        mediaRecorder.start(250); // Send chunks every 250ms
        mediaRecorderRef.current = mediaRecorder;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.channel?.alternatives?.[0]?.transcript) {
            const newTranscript = data.channel.alternatives[0].transcript;

            if (newTranscript.trim()) {
              // Clear silence timer — user is speaking
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
              setShowDoneHint(false);

              if (data.is_final) {
                // Append finalized segment to accumulated transcript
                finalTranscriptRef.current = finalTranscriptRef.current
                  ? finalTranscriptRef.current + ' ' + newTranscript
                  : newTranscript;
                setTranscript(finalTranscriptRef.current);

                // Start 5s silence timer — if no new speech, nudge user
                silenceTimerRef.current = setTimeout(() => {
                  if (finalTranscriptRef.current.trim()) {
                    setShowDoneHint(true);
                  }
                }, 5000);
              } else {
                // Show accumulated + current interim
                setTranscript(
                  finalTranscriptRef.current
                    ? finalTranscriptRef.current + ' ' + newTranscript
                    : newTranscript
                );
              }
            }
          }
        } catch {
          // Ignore malformed Deepgram message
        }
      };

      socket.onerror = () => {
        setError('Voice recognition error');
      };

      socket.onclose = () => {
        setIsListening(false);
      };

      deepgramSocketRef.current = socket;
    } catch {
      setError('Could not access microphone');
    }
  }, []);

  // Fetch interviewer prompt templates from DB once on mount and lock into a ref
  useEffect(() => {
    supabase
      .from('prompts')
      .select('name, system_prompt')
      .in('name', ['round_1_interviewer', 'round_2_interviewer'])
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map: Record<string, string> = {};
          data.forEach((row: { name: string; system_prompt: string }) => {
            map[row.name] = row.system_prompt;
          });
          setPromptTemplates(map);
        }
        // If fetch fails or returns nothing, systemPromptRef stays as fallback (set below)
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach camera stream to video element once it mounts
  // Detect mobile devices
  useEffect(() => {
    const ua = navigator.userAgent;
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
      || (navigator.maxTouchPoints > 0 && /Mobi|Tablet/i.test(ua));
    setIsMobile(mobile);
  }, []);

  useEffect(() => {
    if (isCameraOn && userVideoRef.current && userStreamRef.current) {
      userVideoRef.current.srcObject = userStreamRef.current;
    }
  }, [isCameraOn, callStatus]);

  // Attach camera stream to the check preview video element after render
  useEffect(() => {
    if (mediaCheckDone && !cameraError && checkVideoRef.current && userStreamRef.current) {
      checkVideoRef.current.srcObject = userStreamRef.current;
    }
  }, [mediaCheckDone, cameraError]);

  // Keep refs in sync so async callbacks always read current values
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { sendToAIRef.current = sendToAI; }, [sendToAI]);
  useEffect(() => { startDeepgramListeningRef.current = startDeepgramListening; }, [startDeepgramListening]);

  // Start fetching welcome message TTS immediately on mount (while user is on media-check screen)
  // Stores promises — awaited when user clicks Start Interview
  useEffect(() => {
    const welcomeMessage = round === 2
      ? `Welcome back, ${candidateName}! I'm Nova, the technical interviewer for the ${jobTitle} role at Printerpix. I've reviewed your conversation with Serena, and I was impressed. Now I'd like to dig into some of the technical details you mentioned. Same rules apply — take your time, think out loud if it helps, and ask me to repeat anything. Before we begin, could you just confirm that you can hear me clearly? Once you reply, please click the green 'Done speaking' button to let me know!`
      : `Hi ${candidateName}, great to meet you! I'm Serena, your interviewer for the ${jobTitle} role at Printerpix. It's completely normal to feel a few butterflies — this is a new experience for most people. Today we'll focus on concrete examples from your experience, because that's the best way to understand how you work. Take your time, think out loud if it helps, and ask me to repeat anything if you're unsure. Before we jump into the questions, could you just confirm that you can hear me clearly? Once you reply, please click the green 'Done speaking' button to let me know!`;

    const chunks = splitIntoTTSChunks(welcomeMessage);
    welcomeAudioPromisesRef.current = chunks.map(chunk =>
      fetch('/api/deepgram-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk }),
      }).then(r => {
        if (!r.ok) throw new Error('TTS prefetch failed');
        return r.blob();
      })
    );
  }, [candidateName, jobTitle, round]);

  // Interview timer — starts when call becomes active, cleans up on end/unmount
  // Round 1: 20 min target, wrap-up signal at 18 min, hard cutoff 35 min (emergency only)
  // Round 2: 40 min target, wrap-up signal at 38 min, hard cutoff 55 min (emergency only)
  const wrapUpAt = round === 2 ? 2280 : 1080;    // 38 min : 18 min
  const hardCutoff = round === 2 ? 3300 : 2100;  // 55 min : 35 min (emergency safety net)

  useEffect(() => {
    if (callStatus === 'active') {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1;
          if (next === wrapUpAt) {
            setIsWrappingUp(true);
          }
          if (next >= hardCutoff) {
            endInterviewRef.current?.();
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [callStatus, wrapUpAt, hardCutoff]);

  // Initialize user camera
  const initUserCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      userStreamRef.current = stream;
      setIsCameraOn(true);
    } catch {
      setIsCameraOn(false);
    }
  };

  // Stop media check (analyser loop + audio context)
  const stopMediaCheck = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (checkAudioContextRef.current) {
      checkAudioContextRef.current.close().catch(() => {});
      checkAudioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Pre-interview camera + mic check
  const startMediaCheck = async () => {
    setCameraError(false);
    setMicError(false);
    setError(null);

    let stream: MediaStream | null = null;

    // Try both video + audio first
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      // If both fail, try audio-only
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setCameraError(true);
      } catch {
        // Audio also failed
        setMicError(true);
        setCameraError(true);
        setMediaCheckDone(true);
        return;
      }
    }

    // Camera setup
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
      userStreamRef.current = stream;
      setIsCameraOn(true);
    } else {
      setCameraError(true);
    }

    // Mic setup — analyser for level metering
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      try {
        const audioCtx = new AudioContext();
        checkAudioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const avg = sum / dataArray.length;
          // Map 0-128 → 0-100
          setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);
      } catch {
        setMicError(true);
      }
    } else {
      setMicError(true);
    }

    setMediaCheckDone(true);
  };

  // Toggle microphone
  const toggleMic = () => {
    if (isMicOn) {
      stopDeepgramListening();
      setIsMicOn(false);
    } else {
      setIsMicOn(true);
      startDeepgramListening();
    }
  };

  // Stop the bot mid-sentence (also cancels remaining queued chunks)
  const stopSpeaking = () => {
    speakCancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Also stop browser TTS if it's playing
    speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setSubtitle('');
    // Resume listening after stopping
    if (isMicOn) {
      startDeepgramListening();
    }
  };

  // Start the interview
  const startInterview = async () => {
    setCallStatus('connecting');
    callStatusRef.current = 'connecting';
    setError(null);

    try {
      // Stop the media check analyser loop (camera stream stays alive for reuse)
      stopMediaCheck();

      // If media check wasn't done (shouldn't happen), init camera as fallback
      if (!userStreamRef.current) {
        await initUserCamera();
      }

      // Initialize and start session recording BEFORE welcome message
      // Chunks are written to IndexedDB every 30s — flat RAM usage throughout
      await initSessionRecording();
      if (sessionMediaRecorderRef.current && chunkDBRef.current) {
        sessionMediaRecorderRef.current.start(30_000); // 30-second chunks to IndexedDB
        isRecordingRef.current = true;
      }

      // Auto-enable mic so listening starts after welcome message
      setIsMicOn(true);

      setCallStatus('active');
      callStatusRef.current = 'active';

      // Welcome message - varies by round
      const welcomeMessage = round === 2
        ? `Welcome back, ${candidateName}! I'm Nova, the technical interviewer for the ${jobTitle} role at Printerpix. I've reviewed your conversation with Serena, and I was impressed. Now I'd like to dig into some of the technical details you mentioned. Same rules apply — take your time, think out loud if it helps, and ask me to repeat anything. Before we begin, could you just confirm that you can hear me clearly? Once you reply, please click the green 'Done speaking' button to let me know!`
        : `Hi ${candidateName}, great to meet you! I'm Serena, your interviewer for the ${jobTitle} role at Printerpix. It's completely normal to feel a few butterflies — this is a new experience for most people. Today we'll focus on concrete examples from your experience, because that's the best way to understand how you work. Take your time, think out loud if it helps, and ask me to repeat anything if you're unsure. Before we jump into the questions, could you just confirm that you can hear me clearly? Once you reply, please click the green 'Done speaking' button to let me know!`;

      addToConversation('interviewer', welcomeMessage);

      // Play welcome audio from the requests fired on mount
      // If already resolved → instant playback. If still in-flight → awaits seamlessly.
      isSpeakingRef.current = true;
      speakCancelledRef.current = false;
      setIsSpeaking(true);
      setSubtitle(welcomeMessage);

      if (deepgramSocketRef.current) {
        stopDeepgramListening();
      }

      const promises = welcomeAudioPromisesRef.current!;
      for (const promise of promises) {
        if (speakCancelledRef.current) break;
        const blob = await promise;
        if (speakCancelledRef.current) break;
        await playAudioChunk(blob);
      }

      isSpeakingRef.current = false;
      setIsSpeaking(false);
      if (isMicOnRef.current) {
        startDeepgramListeningRef.current?.();
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start interview');
      setCallStatus('idle');
      callStatusRef.current = 'idle';
    }
  };

  // Format conversation history as readable transcript
  const formatTranscript = useCallback((): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let transcript = `INTERVIEW TRANSCRIPT
================================================================================
Candidate: ${candidateName}
Position: ${jobDescription}
Date: ${dateStr}
Time: ${timeStr}
Round: ${round}
================================================================================

`;

    for (const entry of conversationHistoryRef.current) {
      const role = entry.role === 'interviewer' ? `${interviewerName} (Interviewer)` : `${candidateName} (Candidate)`;
      transcript += `${role}:\n${entry.text}\n\n`;
    }

    return transcript;
  }, [candidateName, jobDescription, interviewerName, round]);

  // End interview and save transcript
  const endInterview = async () => {
    setCallStatus('analyzing');
    callStatusRef.current = 'analyzing';
    setIsSubmitting(true);

    // Stop Deepgram and any playing audio
    stopDeepgramListening();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }


    // --- Phase 1: Stop MediaRecorder, flush final chunk to server ---
    const totalChunks = chunkIndexRef.current;
    if (sessionMediaRecorderRef.current && isRecordingRef.current) {
      try {
        // Stop recorder — triggers one final ondataavailable (uploaded via pendingChunkUploadsRef)
        await new Promise<void>((resolve) => {
          const recorder = sessionMediaRecorderRef.current!;
          const timeout = setTimeout(() => resolve(), 5000);
          recorder.addEventListener('stop', () => { clearTimeout(timeout); resolve(); }, { once: true });
          recorder.stop();
        });
      } catch {
        // Failed to stop recorder cleanly
      }
      isRecordingRef.current = false;
      sessionMediaRecorderRef.current = null;
      recordingStreamRef.current = null;
    }

    // Close recording audio context
    if (recAudioCtxRef.current) {
      recAudioCtxRef.current.close().catch(() => {});
      recAudioCtxRef.current = null;
      recDestinationRef.current = null;
      recMicSourceRef.current = null;
    }

    // Now stop camera/mic tracks
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // --- Phase 2: Wait for all chunk uploads, then ask server to assemble + finalize ---
    if (totalChunks > 0) {
      try {
        setUploadProgress(0);
        // Ensure every in-flight chunk upload (including the final one) reaches the server
        await Promise.allSettled(pendingChunkUploadsRef.current);
        pendingChunkUploadsRef.current = [];
        setUploadProgress(50);

        // Server downloads all chunks from Supabase, concatenates, uploads final file, updates DB
        await fetch('/api/finalize-recording', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateId: parseInt(candidateId), round, chunkCount: totalChunks, mimeType: recordingMimeTypeRef.current }),
        });

        setUploadProgress(100);
      } catch {
        // Finalize failed — chunks are safely stored in Supabase for manual recovery
      } finally {
        setUploadProgress(null);
        if (chunkDBRef.current) {
          idbClearChunks(chunkDBRef.current).catch(() => {});
          chunkDBRef.current = null;
        }
      }
    }

    // --- Phase 3: Save transcript via API (slow — triggers Gemini scoring) ---
    try {
      const transcriptText = formatTranscript();

      const endpoint = round === 2 ? '/api/end-interview-round2' : '/api/end-interview';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: parseInt(candidateId),
          transcript: transcriptText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save interview');
      }

      await response.json();
    } catch {
      setError('Failed to save interview data');
    }

    setIsSubmitting(false);
    setCallStatus('ended');
    callStatusRef.current = 'ended';
  };

  // Keep endInterview ref in sync (defined after the function so it's not used before declaration)
  useEffect(() => { endInterviewRef.current = endInterview; }, [endInterview]);

  // Warn user before closing tab during active interview or submission
  useEffect(() => {
    if (callStatus !== 'active' && callStatus !== 'analyzing') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [callStatus]);

  // If user confirms leaving during active interview, save transcript + recording via sendBeacon
  useEffect(() => {
    const handlePageHide = () => {
      // Only fire if interview is active (not already analyzing/ended)
      if (callStatusRef.current !== 'active') return;

      // Build transcript from refs (no React state dependency)
      const now = new Date();
      const entries = conversationHistoryRef.current;
      if (entries.length === 0) return;

      let transcript = `INTERVIEW TRANSCRIPT\n${'='.repeat(80)}\nCandidate: ${candidateName}\nPosition: ${jobDescription}\nDate: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\nTime: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\nRound: ${round}\nNote: Interview ended early — candidate left the page\n${'='.repeat(80)}\n\n`;
      for (const entry of entries) {
        const role = entry.role === 'interviewer'
          ? `${round === 2 ? 'Nova' : 'Serena'} (Interviewer)`
          : `${candidateName} (Candidate)`;
        transcript += `${role}:\n${entry.text}\n\n`;
      }

      // Send transcript via sendBeacon (survives page unload)
      const endpoint = round === 2 ? '/api/end-interview-round2' : '/api/end-interview';
      const payload = new Blob(
        [JSON.stringify({ candidateId: parseInt(candidateId), transcript })],
        { type: 'application/json' }
      );
      navigator.sendBeacon(endpoint, payload);

      // Stop MediaRecorder so the final chunk is flushed to IndexedDB before page unloads
      // (chunks already written every 30s — this captures the last partial chunk)
      if (sessionMediaRecorderRef.current && isRecordingRef.current) {
        try { sessionMediaRecorderRef.current.stop(); } catch { /* ignore */ }
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [candidateId, candidateName, jobDescription, round]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopDeepgramListening();
      stopMediaCheck();
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Stop session MediaRecorder if still running
      if (sessionMediaRecorderRef.current && isRecordingRef.current) {
        try { sessionMediaRecorderRef.current.stop(); } catch { /* ignore */ }
        sessionMediaRecorderRef.current = null;
      }
      isRecordingRef.current = false;
      recordingStreamRef.current = null;
      if (recAudioCtxRef.current) {
        recAudioCtxRef.current.close().catch(() => {});
        recAudioCtxRef.current = null;
      }
      recDestinationRef.current = null;
      recMicSourceRef.current = null;
    };
  }, [stopDeepgramListening, stopMediaCheck]);

  // ============ RENDER ============

  // Mic level feedback text
  const micFeedback = micLevel < 10 ? 'Too quiet' : micLevel <= 50 ? 'Good!' : 'Great!';
  const micFeedbackColor = micLevel < 10 ? 'text-yellow-400' : 'text-emerald-400';

  // Mobile Device Block
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Monitor className="w-10 h-10 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Desktop Required
          </h1>
          <p className="text-muted-foreground mb-4">
            This interview requires a camera and microphone on a <strong className="text-foreground">desktop or laptop computer</strong>.
          </p>
          <p className="text-muted-foreground/70 text-sm">
            Please open this same link on a computer with a webcam and microphone to continue.
          </p>
        </div>
      </div>
    );
  }

  // Idle State - Start Screen
  if (callStatus === 'idle') {
    const firstName = candidateName?.split(' ')[0] || candidateName;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-xl w-full">
          {/* Printerpix Logo */}
          <div className="text-center mb-8">
            <Image
              src="/logo.jpg"
              alt="Printerpix"
              width={56}
              height={56}
              className="rounded-xl mx-auto mb-4"
            />
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
            Welcome, <span className="text-cyan-400">{firstName}</span>, to your interview for the <span className="text-cyan-400">{jobTitle}</span> role at Printerpix.
          </h1>

          {/* Instructions Card */}
          <div className="bg-card/80 border border-border rounded-2xl p-6 sm:p-8 mb-8">
            <p className="text-muted-foreground text-sm mb-5">
              This is a {round === 2 ? '40' : '15'}-minute guided interview. We want you to perform at your absolute best, so please keep the following in mind:
            </p>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Secure a strong connection:</strong> We record this conversation for our team to review. A stable internet connection ensures your answers are captured in high quality.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Speak clearly and project:</strong> Find a quiet space and speak at a strong, conversational volume so every word is recorded perfectly.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Be detailed and authentic:</strong> Don&apos;t hold back. Give genuine, honest examples from your past work. The more detail you share, the better we can evaluate your fit for the next stage.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Important:</strong> After finishing each answer, please click the <span className="bg-muted px-2 py-0.5 rounded text-white font-semibold">Done Speaking</span> button to advance to the next question.</span>
              </li>
            </ul>
          </div>

          {/* Camera preview + mic level (shown after media check) */}
          {mediaCheckDone && (
            <div className="mb-6 space-y-4">
              {/* Camera preview */}
              <div className="mx-auto w-64 h-48 rounded-xl overflow-hidden border-2 border-border bg-card flex items-center justify-center">
                {cameraError ? (
                  <div className="text-center text-red-400">
                    <CameraOff className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm font-medium">Camera is required for this interview</p>
                    <p className="text-xs text-muted-foreground mt-1">Please allow camera access and reload</p>
                  </div>
                ) : (
                  <video
                    ref={checkVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Mic level bar */}
              {micError ? (
                <div className="flex items-center justify-center gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Microphone required — please allow access and try again</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 max-w-xs mx-auto">
                  <Mic className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-75"
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                  <span className={`text-sm font-medium w-20 text-right ${micFeedbackColor}`}>
                    {micFeedback}
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            {!mediaCheckDone ? (
              <button
                onClick={startMediaCheck}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-lg font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/25"
              >
                Check Camera &amp; Mic
              </button>
            ) : (
              <button
                onClick={startInterview}
                disabled={micError || cameraError}
                className={`px-8 py-4 text-white text-lg font-semibold rounded-xl transition-all transform shadow-lg ${
                  micError || cameraError
                    ? 'bg-muted cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 shadow-cyan-500/25'
                }`}
                title={micError ? 'Microphone is required' : cameraError ? 'Camera is required' : ''}
              >
                Start Interview
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Connecting State
  if (callStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-6" />
          <p className="text-foreground text-xl">Connecting...</p>
          <p className="text-muted-foreground text-sm mt-2">Preparing your interview</p>
        </div>
      </div>
    );
  }

  // Analyzing State
  if (callStatus === 'analyzing') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Submitting Your Interview
          </h2>
          <p className="text-muted-foreground">
            We&apos;re wrapping things up and submitting your responses. This should only take a moment...
          </p>
          {uploadProgress !== null && (
            <div className="mt-6">
              <div className="h-2 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-muted-foreground text-sm mt-2">Uploading recording...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Ended State
  if (callStatus === 'ended') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card rounded-2xl p-10 max-w-md mx-auto text-center border border-border shadow-xl">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Interview Complete!
          </h1>
          <p className="text-muted-foreground mb-2">
            Thank you for your time, {candidateName}.
          </p>
          <p className="text-muted-foreground text-sm">
            Your responses have been recorded and sent to our team. We&apos;ll be in touch soon!
          </p>
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-muted-foreground text-xs">
              Experienced a technical issue? Contact us at{' '}
              <a href="mailto:printerpix.recruitment@gmail.com" className="text-cyan-400 hover:text-cyan-300 underline">
                printerpix.recruitment@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============ ACTIVE INTERVIEW STATE ============
  const timerMinutes = Math.floor(elapsedSeconds / 60);
  const timerSecs = elapsedSeconds % 60;
  const timerDisplay = `${timerMinutes.toString().padStart(2, '0')}:${timerSecs.toString().padStart(2, '0')}`;
  const timerUrgent = elapsedSeconds >= wrapUpAt;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Exit button - fixed top left */}
      <button
        onClick={() => setShowExitModal(true)}
        className="fixed top-4 left-4 z-20 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-all flex items-center justify-center"
        title="Exit Interview"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <h2 className="text-xl font-bold text-foreground mb-3">Exit Interview?</h2>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to exit the interview without completing it? Your progress will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 px-4 py-3 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-all"
              >
                Continue Interview
              </button>
              <button
                onClick={() => {
                  setShowExitModal(false);
                  endInterview();
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-all"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timer - fixed top right */}
      <div className="fixed top-4 right-4 z-20">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border ${
          timerUrgent
            ? 'bg-red-500/20 border-red-500/40 text-red-400'
            : 'bg-card/80 border-border text-muted-foreground'
        }`}>
          <Clock className="w-4 h-4" />
          <span className={`font-mono text-lg font-semibold ${timerUrgent ? 'animate-pulse' : ''}`}>
            {timerDisplay}
          </span>
        </div>
      </div>

      {/* Main Interview Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="relative w-full max-w-2xl">
          {/* Pulsing Circle Avatar */}
          <div className="flex flex-col items-center justify-center">
            <div className={`relative w-48 h-48 mb-8 ${isSpeaking ? 'animate-pulse' : ''}`}>
              {/* Outer glow rings when speaking */}
              {isSpeaking && (
                <>
                  <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
                  <div className="absolute inset-2 bg-cyan-500/30 rounded-full animate-ping" style={{ animationDuration: '1.2s' }} />
                </>
              )}
              
              {/* Main circle */}
              <div className={`absolute inset-4 rounded-full flex items-center justify-center transition-all duration-300 ${
                isSpeaking 
                  ? 'bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/50' 
                  : 'bg-gradient-to-br from-muted to-muted/80'
              }`}>
                <Volume2 className={`w-16 h-16 transition-colors ${isSpeaking ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
            </div>

            {/* Interviewer Name */}
            <h2 className="text-2xl font-bold text-foreground mb-2">{interviewerName}</h2>
            <p className="text-muted-foreground text-sm mb-8">
              {round === 2 ? 'Technical Interviewer' : 'Talent Scout'}
            </p>
          </div>

        </div>
      </div>

      {/* User Camera (fixed, bottom right above subtitle + control bars) */}
      {isCameraOn && (
        <div className="fixed bottom-[16rem] right-6 w-36 h-28 rounded-lg overflow-hidden border-2 border-border shadow-xl z-10">
          <video
            ref={userVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Subtitle Area */}
      <div className="min-h-24 max-h-48 bg-card/80 backdrop-blur-sm border-t border-border flex items-end justify-center px-8 py-4 overflow-y-auto">
        <div className="max-w-3xl w-full text-center">
          {isSpeaking && subtitle && (
            <p className="text-foreground text-base font-medium leading-relaxed">
              {subtitle}
            </p>
          )}
          {!isSpeaking && transcript && (
            <p className="text-cyan-400 text-base italic leading-relaxed">
              &ldquo;{transcript}&rdquo;
            </p>
          )}
          {!isSpeaking && !transcript && isListening && (
            <p className="text-muted-foreground text-lg">
              Please begin speaking...
            </p>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="h-24 bg-card border-t border-border flex items-center justify-center gap-6">
        {/* Done Speaking Button */}
        {!isSpeaking && (
          <div className="relative flex items-center">
            <button
              onClick={() => sendToAI(transcript)}
              disabled={!transcript.trim()}
              className={`px-6 h-14 rounded-full text-white font-semibold flex items-center justify-center gap-2 transition-all ${
                transcript.trim()
                  ? `bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25${showDoneHint ? ' animate-breathe-glow' : ''}`
                  : 'bg-muted opacity-50 cursor-not-allowed'
              }`}
              title="Send your response"
            >
              Done Speaking
            </button>
            {/* Silence nudge — appears after 5s of silence, anchored to the right of the button */}
            {showDoneHint && transcript.trim() && (
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap animate-in fade-in duration-300 z-10">
                <div className="relative bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg shadow-emerald-500/30">
                  {/* Left-pointing caret connecting tooltip to button */}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-r-[7px] border-y-transparent border-r-emerald-500" />
                  All finished? Click here to continue.
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-lg">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-4 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
