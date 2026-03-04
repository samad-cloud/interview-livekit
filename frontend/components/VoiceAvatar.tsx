'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent, DataPacket_Kind, ConnectionState } from 'livekit-client';
import { Mic, CameraOff, Loader2, Volume2, AlertCircle, Clock, Monitor, X } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

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
  | 'permission'      // requesting mic access
  | 'connecting'      // joining LiveKit room
  | 'active'          // interview in progress
  | 'ending'          // END_INTERVIEW received, submitting scores
  | 'completed';      // all done

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

  // State
  const [phase, setPhase] = useState<InterviewPhase>('permission');
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // Refs
  const roomRef = useRef<Room | null>(null);
  const egressIdRef = useRef<string | null>(null);
  const interviewStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const conversationRef = useRef<ConversationEntry[]>([]);
  const endingRef = useRef(false);  // prevent double-end

  // Keep conversationRef in sync for use in callbacks
  conversationRef.current = conversation;

  // ── Timer ──────────────────────────────────────────────────────────────────

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

  // ── End interview ──────────────────────────────────────────────────────────

  const endInterview = useCallback(async (finalConversation?: ConversationEntry[]) => {
    if (endingRef.current) return;
    endingRef.current = true;
    setPhase('ending');
    stopTimer();

    const transcriptToSubmit = finalConversation || conversationRef.current;

    // Stop Egress recording and get video URL
    if (egressIdRef.current) {
      try {
        await fetch('/api/livekit/stop-egress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            egressId: egressIdRef.current,
            candidateId,
            round,
          }),
        });
      } catch (err) {
        console.error('[VoiceAvatar] Stop egress failed:', err);
      }
    }

    // Disconnect from room
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Submit transcript for scoring (same API as before — unchanged)
    const endpoint = round === 2 ? '/api/end-interview-round2' : '/api/end-interview';
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          conversation: transcriptToSubmit.map(e => ({
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
  }, [candidateId, round, stopTimer]);

  // ── Connect to LiveKit room ────────────────────────────────────────────────

  const connectToRoom = useCallback(async () => {
    setPhase('connecting');

    try {
      // Get a LiveKit token from our server
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          round,
          candidateName,
          jobTitle,
          jobDescription,
          resumeText,
          dossier,
        }),
      });

      if (!tokenRes.ok) throw new Error('Failed to get LiveKit token');
      const { token, serverUrl, egressId } = await tokenRes.json();

      egressIdRef.current = egressId;

      // Create and connect LiveKit room
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

      // Connection state tracking
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

      // Data messages from agent
      room.on(RoomEvent.DataReceived, (data: Uint8Array) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(data));

          if (msg.type === 'transcript' && msg.entry) {
            const entry: ConversationEntry = {
              ...msg.entry,
              timestamp: new Date(),
            };
            setConversation(prev => [...prev, entry]);
          } else if (msg.type === 'end_interview') {
            // Agent signalled end — use the transcript it sends
            const agentTranscript: ConversationEntry[] = (msg.transcript || []).map(
              (e: Omit<ConversationEntry, 'timestamp'>) => ({ ...e, timestamp: new Date() })
            );
            endInterview(agentTranscript.length > 0 ? agentTranscript : undefined);
          }
        } catch {
          // Ignore malformed data messages
        }
      });

      // Track when agent is speaking (their audio track becomes active)
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const agentIsSpeaking = speakers.some(p => p.identity.startsWith('agent'));
        setIsAgentSpeaking(agentIsSpeaking);
      });

      // Connect to room and publish microphone
      await room.connect(serverUrl, token);
      await room.localParticipant.setMicrophoneEnabled(true);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      console.error('[VoiceAvatar] Connect error:', err);
      setError(`Could not connect to interview: ${message}`);
      setPhase('permission');
    }
  }, [candidateId, round, candidateName, jobTitle, jobDescription, resumeText, dossier, endInterview, startTimer]);

  // ── Request mic permission ─────────────────────────────────────────────────

  const requestPermission = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicError(null);
      await connectToRoom();
    } catch {
      setMicError('Microphone access is required. Please allow access and try again.');
    }
  }, [connectToRoom]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopTimer();
      roomRef.current?.disconnect();
    };
  }, [stopTimer]);

  // ── Format timer ───────────────────────────────────────────────────────────

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── UI Render ──────────────────────────────────────────────────────────────
  // NOTE: UI below is preserved exactly from the original — only infrastructure changed above.

  // Permission screen
  if (phase === 'permission') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mic className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Ready to begin your interview?
          </h1>
          <p className="text-muted-foreground mb-2">
            You&apos;ll be speaking with <strong>{interviewerName}</strong>, your AI interviewer for{' '}
            <strong>{jobTitle}</strong>.
          </p>
          <p className="text-muted-foreground mb-8 text-sm">
            Microphone access is required. Your interview will be recorded.
          </p>
          {micError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {micError}
            </div>
          )}
          <button
            onClick={requestPermission}
            className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  // Connecting screen
  if (phase === 'connecting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-foreground text-lg">Connecting to your interview...</p>
          <p className="text-muted-foreground text-sm mt-2">Setting up secure voice connection</p>
        </div>
      </div>
    );
  }

  // Error screen
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
            onClick={() => { setError(null); setPhase('permission'); endingRef.current = false; }}
            className="px-6 py-3 bg-card hover:bg-muted text-foreground rounded-lg transition-colors border border-border"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Ending/submitting screen
  if (phase === 'ending') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-foreground text-lg">Submitting your interview...</p>
        </div>
      </div>
    );
  }

  // Completed screen
  if (phase === 'completed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="rounded-2xl p-10 max-w-md mx-auto text-center border border-border bg-card shadow-xl">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Volume2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Interview Complete
          </h1>
          <p className="text-muted-foreground mb-2">
            Thank you, {candidateName}.
          </p>
          <p className="text-muted-foreground/70 text-sm">
            Your responses have been submitted. We&apos;ll be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  // Active interview screen
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${
            connectionState === ConnectionState.Connected
              ? 'bg-emerald-500 animate-pulse'
              : 'bg-yellow-500'
          }`} />
          <span className="text-sm text-muted-foreground">
            {connectionState === ConnectionState.Connected
              ? `Connected — ${interviewerName} is interviewing you`
              : 'Reconnecting...'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-sm">{formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        {/* Conversation panel */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
          {conversation.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {isAgentSpeaking ? `${interviewerName} is speaking...` : 'Waiting for the interview to begin...'}
            </div>
          )}
          {conversation.map((entry, i) => (
            <div
              key={i}
              className={`flex gap-3 ${entry.role === 'candidate' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-muted text-muted-foreground">
                {entry.speaker[0]}
              </div>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                  entry.role === 'candidate'
                    ? 'bg-emerald-600/20 text-foreground ml-auto'
                    : 'bg-card text-foreground border border-border'
                }`}
              >
                <p className="text-xs text-muted-foreground mb-1">{entry.speaker}</p>
                <p>{entry.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Status sidebar */}
        <div className="w-56 flex flex-col gap-4 shrink-0">
          {/* Agent speaking indicator */}
          <div className={`rounded-xl p-4 border transition-colors ${
            isAgentSpeaking
              ? 'border-emerald-500/50 bg-emerald-500/10'
              : 'border-border bg-card'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className={`w-4 h-4 ${isAgentSpeaking ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              <span className="text-sm font-medium">{interviewerName}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isAgentSpeaking ? 'Speaking...' : 'Listening'}
            </p>
          </div>

          {/* Mic status */}
          <div className="rounded-xl p-4 border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium">Your mic</span>
            </div>
            <p className="text-xs text-muted-foreground">Active — speak clearly</p>
          </div>

          {/* End button */}
          <button
            onClick={() => endInterview()}
            className="mt-auto flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
          >
            <X className="w-4 h-4" />
            End Interview
          </button>
        </div>
      </div>
    </div>
  );
}