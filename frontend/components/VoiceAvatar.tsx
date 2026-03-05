'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent, ConnectionState, Track, type TranscriptionSegment } from 'livekit-client';
import { Mic, CameraOff, Loader2, Volume2, AlertCircle, Clock, X } from 'lucide-react';
import Image from 'next/image';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConversationEntry {
  role: 'interviewer' | 'candidate';
  speaker: string;
  text: string;
  timestamp: Date;
}

interface VoiceAvatarProps {
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  round?: number;
  dossier?: string[];
}

type InterviewPhase =
  | 'idle'        // start screen + camera/mic check
  | 'connecting'  // joining LiveKit room
  | 'active'      // interview in progress
  | 'ending'      // submitting scores
  | 'completed';  // all done

// ── Component ─────────────────────────────────────────────────────────────────

export default function VoiceAvatar({
  candidateId,
  candidateName,
  jobTitle,
  jobDescription,
  resumeText,
  round = 1,
  dossier,
}: VoiceAvatarProps) {

  const interviewerName = round === 2 ? 'Nova' : 'Serena';
  const interviewerTitle = round === 2 ? 'Technical Interviewer' : 'Talent Scout';
  const interviewMinutes = round === 2 ? 40 : 15;
  const wrapUpAt = round === 2 ? 38 * 60 : 13 * 60;

  // ── Phase & error state ───────────────────────────────────────────────────
  const [phase, setPhase] = useState<InterviewPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  // ── Media check state ─────────────────────────────────────────────────────
  const [mediaCheckDone, setMediaCheckDone] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [micError, setMicError] = useState(false);

  // ── Active interview state ────────────────────────────────────────────────
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Live subtitle: what is being said right now
  type SubtitleMode = 'agent' | 'user' | 'listening';
  const [liveText, setLiveText] = useState('');
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('listening');

  // Done Speaking button — shown only when agent has fully finished (debounced)
  const [showDoneButton, setShowDoneButton] = useState(false);
  const doneButtonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const roomRef = useRef<Room | null>(null);
  const egressIdRef = useRef<string | null>(null);
  const interviewStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const conversationRef = useRef<ConversationEntry[]>([]);
  const endingRef = useRef(false);

  // Camera refs
  const checkVideoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);

  // Turn-taking: track whether agent has spoken at least once
  const agentHasSpokenRef = useRef(false);

  // Keep conversationRef in sync
  conversationRef.current = conversation;

  // Mic mute + subtitle mode + done-button — all driven by isAgentSpeaking
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;

    if (isAgentSpeaking) {
      // Agent started speaking: mute mic, cancel pending done-button timer, hide button
      agentHasSpokenRef.current = true;
      room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      if (doneButtonTimerRef.current) clearTimeout(doneButtonTimerRef.current);
      setShowDoneButton(false);
      setSubtitleMode('agent');
    } else if (agentHasSpokenRef.current) {
      // Agent finished: unmute mic, switch to listening, show done button after debounce
      room.localParticipant.setMicrophoneEnabled(true).catch(() => {});
      setLiveText('');
      setSubtitleMode('listening');
      doneButtonTimerRef.current = setTimeout(() => setShowDoneButton(true), 800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgentSpeaking]);

  // ── Timer ─────────────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    interviewStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - interviewStartRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Stop camera stream ────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    micAudioCtxRef.current?.close();
    micAudioCtxRef.current = null;
    userStreamRef.current?.getTracks().forEach(t => t.stop());
    userStreamRef.current = null;
    setIsCameraOn(false);
  }, []);

  // ── End interview ─────────────────────────────────────────────────────────

  const endInterview = useCallback(async (finalConversation?: ConversationEntry[]) => {
    if (endingRef.current) return;
    endingRef.current = true;
    setPhase('ending');
    stopTimer();
    stopCamera();

    const transcriptToSubmit = finalConversation || conversationRef.current;

    if (egressIdRef.current) {
      try {
        await fetch('/api/livekit/stop-egress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ egressId: egressIdRef.current, candidateId, round }),
        });
      } catch (err) {
        console.error('[VoiceAvatar] Stop egress failed:', err);
      }
    }

    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }

    const endpoint = round === 2 ? '/api/end-interview-round2' : '/api/end-interview';
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          transcript: transcriptToSubmit.map(e => ({
            role: e.role,
            speaker: e.speaker,
            text: e.text,
          })),
        }),
      });
    } catch (err) {
      console.error('[VoiceAvatar] End interview API failed:', err);
    }

    setPhase('completed');
  }, [candidateId, round, stopTimer, stopCamera]);

  // ── Connect to LiveKit room ────────────────────────────────────────────────

  const connectToRoom = useCallback(async () => {
    setPhase('connecting');

    try {
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId, round, candidateName, jobTitle, jobDescription, resumeText, dossier,
        }),
      });

      if (!tokenRes.ok) throw new Error('Failed to get LiveKit token');
      const { token, serverUrl, egressId } = await tokenRes.json();
      egressIdRef.current = egressId;

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      roomRef.current = room;

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setConnectionState(state);
        if (state === ConnectionState.Connected) {
          setPhase('active');
          startTimer();
        } else if (state === ConnectionState.Disconnected) {
          if (!endingRef.current) {
            setError('Connection lost. Please refresh to reconnect.');
          }
        }
      });

      room.on(RoomEvent.DataReceived, (data: Uint8Array) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(data));
          if (msg.type === 'transcript' && msg.entry) {
            const entry: ConversationEntry = { ...msg.entry, timestamp: new Date() };
            setConversation(prev => [...prev, entry]);
          } else if (msg.type === 'end_interview') {
            const agentTranscript: ConversationEntry[] = (msg.transcript || []).map(
              (e: Omit<ConversationEntry, 'timestamp'>) => ({ ...e, timestamp: new Date() })
            );
            endInterview(agentTranscript.length > 0 ? agentTranscript : undefined);
          }
        } catch {
          // Ignore malformed messages
        }
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const agentIsSpeaking = speakers.some(p => p.identity.startsWith('agent'));
        setIsAgentSpeaking(agentIsSpeaking);
      });

      // Auto-attach remote audio tracks so agent voice is audible
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          document.body.appendChild(el);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
      });

      // Real-time transcription: show text as agent/user speaks
      room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[], participant) => {
        const text = segments.map(s => s.text).join('').trim();
        if (!text) return;
        const isAgent = participant?.identity?.startsWith('agent') ?? false;
        if (isAgent) {
          setLiveText(text);
          setSubtitleMode('agent');
        } else {
          setLiveText(text);
          setSubtitleMode('user');
        }
      });

      await room.connect(serverUrl, token);
      await room.startAudio();
      // Start with mic muted — unmuted automatically after agent finishes first turn
      await room.localParticipant.setMicrophoneEnabled(false);

      // Wire user camera to PiP video element after connecting
      if (userStreamRef.current && userVideoRef.current) {
        userVideoRef.current.srcObject = userStreamRef.current;
        setIsCameraOn(true);
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      console.error('[VoiceAvatar] Connect error:', err);
      setError(`Could not connect to interview: ${message}`);
      setPhase('idle');
    }
  }, [candidateId, round, candidateName, jobTitle, jobDescription, resumeText, dossier, endInterview, startTimer]);

  // ── Camera + mic check ────────────────────────────────────────────────────

  const startMediaCheck = useCallback(async () => {
    setCameraError(false);
    setMicError(false);

    let videoOk = false;
    let audioOk = false;
    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoOk = true;
      audioOk = true;
    } catch {
      // Try audio-only
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioOk = true;
        setCameraError(true);
      } catch {
        setMicError(true);
        setCameraError(true);
        setMediaCheckDone(true);
        return;
      }
    }

    if (stream) {
      userStreamRef.current = stream;

      if (videoOk && checkVideoRef.current) {
        checkVideoRef.current.srcObject = stream;
      }

      // Mic level visualiser
      if (audioOk) {
        try {
          const audioCtx = new AudioContext();
          micAudioCtxRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          micAnalyserRef.current = analyser;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          const buf = new Uint8Array(analyser.frequencyBinCount);

          const tick = () => {
            analyser.getByteFrequencyData(buf);
            const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
            setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
            micAnimFrameRef.current = requestAnimationFrame(tick);
          };
          tick();
        } catch {
          // Visualiser optional
        }
      }
    }

    setMediaCheckDone(true);
  }, []);

  // ── Start interview (after media check) ───────────────────────────────────

  const startInterview = useCallback(async () => {
    // Stop mic-level animation — LiveKit will handle audio capture
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    micAudioCtxRef.current?.close();
    micAudioCtxRef.current = null;

    // Stop existing audio tracks so LiveKit can re-acquire the mic
    if (userStreamRef.current) {
      userStreamRef.current.getAudioTracks().forEach(t => t.stop());
    }

    await connectToRoom();
  }, [connectToRoom]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopTimer();
      stopCamera();
      if (doneButtonTimerRef.current) clearTimeout(doneButtonTimerRef.current);
      roomRef.current?.disconnect();
    };
  }, [stopTimer, stopCamera]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const timerUrgent = elapsedSeconds >= wrapUpAt;

  const micFeedback =
    micLevel === 0   ? 'No signal'   :
    micLevel < 10    ? 'Very low'    :
    micLevel < 30    ? 'Good'        :
    micLevel < 60    ? 'Great'       : 'Too loud';
  const micFeedbackColor =
    micLevel === 0   ? 'text-muted-foreground' :
    micLevel < 10    ? 'text-red-400'           :
    micLevel < 30    ? 'text-emerald-400'       :
    micLevel < 60    ? 'text-emerald-400'       : 'text-yellow-400';

  const firstName = candidateName?.split(' ')[0] || candidateName;

  // ── Render: error ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Connection Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => { setError(null); setPhase('idle'); endingRef.current = false; }}
            className="px-6 py-3 bg-card hover:bg-muted text-foreground rounded-lg transition-colors border border-border"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Render: connecting ────────────────────────────────────────────────────

  if (phase === 'connecting') {
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

  // ── Render: ending ────────────────────────────────────────────────────────

  if (phase === 'ending') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Submitting Your Interview</h2>
          <p className="text-muted-foreground">
            We&apos;re wrapping things up and submitting your responses. This should only take a moment...
          </p>
        </div>
      </div>
    );
  }

  // ── Render: completed ─────────────────────────────────────────────────────

  if (phase === 'completed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card rounded-2xl p-10 max-w-md mx-auto text-center border border-border shadow-xl">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Interview Complete!</h1>
          <p className="text-muted-foreground mb-2">Thank you for your time, {candidateName}.</p>
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

  // ── Render: idle (start screen) ───────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-xl w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <Image src="/logo.jpg" alt="Printerpix" width={56} height={56} className="rounded-xl mx-auto mb-4" />
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
            Welcome, <span className="text-cyan-400">{firstName}</span>, to your interview for the{' '}
            <span className="text-cyan-400">{jobTitle}</span> role at Printerpix.
          </h1>

          {/* Instructions */}
          <div className="bg-card/80 border border-border rounded-2xl p-6 sm:p-8 mb-8">
            <p className="text-muted-foreground text-sm mb-5">
              This is a {interviewMinutes}-minute guided interview. We want you to perform at your absolute best, so please keep the following in mind:
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
                <span><strong className="text-foreground">Finish your answer:</strong> After completing your response, pause for a moment and the interviewer will respond automatically.</span>
              </li>
            </ul>
          </div>

          {/* Camera preview + mic level */}
          {mediaCheckDone && (
            <div className="mb-6 space-y-4">
              <div className="mx-auto w-64 h-48 rounded-xl overflow-hidden border-2 border-border bg-card flex items-center justify-center">
                {cameraError ? (
                  <div className="text-center text-muted-foreground px-4">
                    <CameraOff className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">No camera detected</p>
                    <p className="text-xs text-muted-foreground mt-1">You can still proceed without a camera</p>
                  </div>
                ) : (
                  <video ref={checkVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                )}
              </div>

              {micError ? (
                <div className="flex items-center justify-center gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Microphone required — please allow access and try again</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 max-w-xs mx-auto">
                  <Mic className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-75" style={{ width: `${micLevel}%` }} />
                  </div>
                  <span className={`text-sm font-medium w-20 text-right ${micFeedbackColor}`}>{micFeedback}</span>
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
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
                disabled={micError}
                className={`px-8 py-4 text-white text-lg font-semibold rounded-xl transition-all transform shadow-lg ${
                  micError
                    ? 'bg-muted cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 shadow-cyan-500/25'
                }`}
              >
                Start Interview
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: active interview ──────────────────────────────────────────────

  const lastEntry = conversation[conversation.length - 1];

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Exit button — fixed top left */}
      <button
        onClick={() => setShowExitModal(true)}
        className="fixed top-4 left-4 z-20 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-all flex items-center justify-center"
        title="Exit Interview"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Exit confirmation modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <h2 className="text-xl font-bold text-foreground mb-3">Exit Interview?</h2>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to exit? Your progress will be submitted as-is.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 px-4 py-3 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-all"
              >
                Continue Interview
              </button>
              <button
                onClick={() => { setShowExitModal(false); endInterview(); }}
                className="flex-1 px-4 py-3 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-all"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timer — fixed top right */}
      <div className="fixed top-4 right-4 z-20">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border ${
          timerUrgent
            ? 'bg-red-500/20 border-red-500/40 text-red-400'
            : 'bg-card/80 border-border text-muted-foreground'
        }`}>
          <Clock className="w-4 h-4" />
          <span className={`font-mono text-lg font-semibold ${timerUrgent ? 'animate-pulse' : ''}`}>
            {formatTime(elapsedSeconds)}
          </span>
        </div>
      </div>

      {/* Main interview area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center justify-center">
          {/* Pulsing avatar */}
          <div className={`relative w-48 h-48 mb-8 ${isAgentSpeaking ? 'animate-pulse' : ''}`}>
            {isAgentSpeaking && (
              <>
                <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute inset-2 bg-cyan-500/30 rounded-full animate-ping" style={{ animationDuration: '1.2s' }} />
              </>
            )}
            <div className={`absolute inset-4 rounded-full flex items-center justify-center transition-all duration-300 ${
              isAgentSpeaking
                ? 'bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/50'
                : 'bg-gradient-to-br from-muted to-muted/80'
            }`}>
              <Volume2 className={`w-16 h-16 transition-colors ${isAgentSpeaking ? 'text-white' : 'text-muted-foreground'}`} />
            </div>
          </div>

          {/* Interviewer name */}
          <h2 className="text-2xl font-bold text-foreground mb-2">{interviewerName}</h2>
          <p className="text-muted-foreground text-sm">
            {connectionState === ConnectionState.Connected ? interviewerTitle : 'Connecting...'}
          </p>
        </div>
      </div>

      {/* User camera PiP — bottom right */}
      {isCameraOn && (
        <div className="fixed bottom-[10rem] right-6 w-36 h-28 rounded-lg overflow-hidden border-2 border-border shadow-xl z-10">
          <video ref={userVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
      )}

      {/* Subtitle area — live real-time display */}
      <div className="min-h-24 max-h-48 bg-card/80 backdrop-blur-sm border-t border-border flex items-end justify-center px-8 py-4 overflow-y-auto">
        <div className="max-w-3xl w-full text-center">
          {subtitleMode === 'agent' && liveText && (
            <p className="text-foreground text-base font-medium leading-relaxed">{liveText}</p>
          )}
          {subtitleMode === 'user' && liveText && (
            <p className="text-cyan-400 text-base italic leading-relaxed">&ldquo;{liveText}&rdquo;</p>
          )}
          {(subtitleMode === 'listening' || !liveText) && (
            <p className="text-muted-foreground text-lg">
              {!agentHasSpokenRef.current
                ? connectionState === ConnectionState.Connected
                  ? 'Interview starting — please wait...'
                  : 'Connecting...'
                : 'Listening...'}
            </p>
          )}
        </div>
      </div>

      {/* Control bar */}
      <div className="h-24 bg-card border-t border-border flex items-center justify-center gap-6">
        {/* Done Speaking — only shows after agent fully finishes (debounced) */}
        {showDoneButton && (
          <button
            onClick={async () => {
              setShowDoneButton(false);
              if (doneButtonTimerRef.current) clearTimeout(doneButtonTimerRef.current);
              if (roomRef.current) {
                await roomRef.current.localParticipant.setMicrophoneEnabled(false);
              }
            }}
            className="px-6 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25"
          >
            Done Speaking
          </button>
        )}
      </div>
    </div>
  );
}
