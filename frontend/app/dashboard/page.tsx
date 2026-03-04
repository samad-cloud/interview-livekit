'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { createClient as createBrowserSupabase } from '@/lib/supabase-browser';
import { sendInterviewInvite, inviteToRound2 } from '@/app/actions/sendInvite';
import { generateInterviewNotes, type InterviewNotes } from '@/app/actions/generateNotes';
import {
  Trophy,
  Clock,
  Eye,
  FileText,
  Briefcase,
  Send,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Filter,
  Zap,
  Search,
  Video,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Loader2,
  Sparkles,
  NotebookPen,
  Info,
  CheckCircle2,
  XCircle,
  MessageSquare,
  UserCheck,
  RotateCcw,
  Download,
  Users,
  Target,
  SlidersHorizontal,
  X,
  Calendar,
  MoreHorizontal,
  SearchX,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import VideoPlayer from '@/components/VideoPlayer';
import { useRouter } from 'next/navigation';

// shadcn components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FullVerdict {
  technicalScore: number;
  verdict: string;
  summary: string;
  technicalStrengths: string[];
  technicalGaps: string[];
  recommendation: string;
}

interface FullDossier {
  probeQuestions: { question: string; targetClaim: string; probeType: string }[];
  candidateStrengths: string[];
  areasToProbe: string[];
  overallAssessment: string;
}

type SortColumn = 'created_at' | 'jd_match_score' | 'combined_score' | 'round_1_completed_at' | 'round_2_completed_at';
type SortDirection = 'asc' | 'desc';

interface Candidate {
  id: number;
  full_name: string;
  email: string;
  rating: number | null;
  round_2_rating: number | null;
  jd_match_score: number | null;
  ai_summary: string | null;
  interview_notes: InterviewNotes | null;
  status: string;
  current_stage: string | null;
  interview_transcript: string | null;
  round_2_transcript: string | null;
  resume_text: string | null;
  job_id: string | null;
  job_title?: string;
  final_verdict: string | null;
  interview_token: string | null;
  created_at: string | null;
  video_url: string | null;
  round_2_video_url: string | null;
  full_verdict: FullVerdict | null;
  round_1_full_dossier: FullDossier | null;
  hr_notes: string | null;
  resume_url: string | null;
  applied_at: string | null;
  round_1_completed_at: string | null;
  round_2_completed_at: string | null;
}

interface Job {
  id: string;
  title: string;
}

interface Stats {
  applied: number;
  passedCvFilter: number;
  invitedR1: number;
  completedR1: number;
  invitedR2: number;
  completedR2: number;
  successful: number;
}

const PAGE_SIZE = 25;

// --- Boolean Search Parser ---
// Supports: AND, OR, NOT, quoted phrases
// Example: "machine learning" AND Python NOT Java
interface BooleanClause {
  type: 'AND' | 'OR' | 'NOT';
  term: string;
}

function parseBooleanQuery(input: string): BooleanClause[] {
  const clauses: BooleanClause[] = [];
  if (!input.trim()) return clauses;

  // Tokenize: extract quoted phrases and individual words
  const tokens: string[] = [];
  const regex = /"([^"]+)"|(\S+)/g;
  let match;
  while ((match = regex.exec(input)) !== null) {
    tokens.push(match[1] || match[2]);
  }

  let nextType: 'AND' | 'OR' | 'NOT' = 'AND';
  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (upper === 'AND') { nextType = 'AND'; continue; }
    if (upper === 'OR') { nextType = 'OR'; continue; }
    if (upper === 'NOT') { nextType = 'NOT'; continue; }
    clauses.push({ type: nextType, term: token });
    nextType = 'AND'; // default back to AND
  }

  return clauses;
}

export default function DashboardPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobMap, setJobMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<Stats>({ applied: 0, passedCvFilter: 0, invitedR1: 0, completedR1: 0, invitedR2: 0, completedR2: 0, successful: 0 });

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Unified bulk action modal: confirm → progress → done
  const [bulkModal, setBulkModal] = useState<{
    phase: 'confirm' | 'progress' | 'done';
    title: string;
    description: string;
    variant?: 'default' | 'destructive';
    onConfirm: () => void;
    // progress state
    processed: number;
    total: number;
    succeeded: number;
    currentName?: string;
    // done state
    resultTitle?: string;
    resultDescription?: string;
    resultVariant?: 'success' | 'error';
  } | null>(null);

  // Simple toast for non-bulk single-action feedback
  const [toastModal, setToastModal] = useState<{
    title: string;
    description: string;
    variant?: 'success' | 'error';
  } | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

  // Boolean resume search
  const [resumeSearchInput, setResumeSearchInput] = useState('');
  const [resumeSearchQuery, setResumeSearchQuery] = useState('');

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>('combined_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [cvScoreMin, setCvScoreMin] = useState('');
  const [cvScoreMax, setCvScoreMax] = useState('');
  const [r1ScoreMin, setR1ScoreMin] = useState('');
  const [r1ScoreMax, setR1ScoreMax] = useState('');
  const [r2ScoreMin, setR2ScoreMin] = useState('');
  const [r2ScoreMax, setR2ScoreMax] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [r1DateFrom, setR1DateFrom] = useState('');
  const [r1DateTo, setR1DateTo] = useState('');
  const [r2DateFrom, setR2DateFrom] = useState('');
  const [r2DateTo, setR2DateTo] = useState('');

  // Notes
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [interviewNotes, setInterviewNotes] = useState<InterviewNotes | null>(null);

  // HR Decision
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);

  // Load saved notes when candidate is selected
  useEffect(() => {
    if (selectedCandidate?.interview_notes) {
      setInterviewNotes(selectedCandidate.interview_notes);
    }
  }, [selectedCandidate]);

  // Reset note input when candidate changes
  useEffect(() => {
    setNoteText(selectedCandidate?.hr_notes || '');
  }, [selectedCandidate]);

  // Stitch recording
  const [stitchingRound, setStitchingRound] = useState<1 | 2 | null>(null);

  const handleStitchRecording = async (round: 1 | 2) => {
    if (!selectedCandidate) return;
    setStitchingRound(round);
    try {
      const res = await fetch('/api/finalize-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: selectedCandidate.id, round }),
      });
      const data = await res.json();
      if (data.success) {
        const videoColumn = round === 2 ? 'round_2_video_url' : 'video_url';
        setSelectedCandidate(prev => prev ? { ...prev, [videoColumn]: data.url } : prev);
        setCandidates(prev => prev.map(c => c.id === selectedCandidate.id ? { ...c, [videoColumn]: data.url } : c));
        setToastModal({ title: 'Recording stitched', description: `Round ${round} recording assembled successfully.`, variant: 'success' });
      } else {
        setToastModal({ title: 'Stitch failed', description: data.error || 'Could not assemble recording.', variant: 'error' });
      }
    } catch {
      setToastModal({ title: 'Stitch failed', description: 'Network error — check Vercel logs.', variant: 'error' });
    } finally {
      setStitchingRound(null);
    }
  };

  // Action states
  const [sendingInvite, setSendingInvite] = useState<number | null>(null);
  const [revertingCandidate, setRevertingCandidate] = useState<number | null>(null);
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  // SSR-aware client for auth operations (properly handles cookies)
  const authSupabase = createBrowserSupabase();

  // Client-side auth guard — catches cases where middleware is bypassed (e.g. client-side nav cache)
  useEffect(() => {
    const sb = createBrowserSupabase();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login?redirect=/dashboard');
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleLogout = async () => {
    await authSupabase.auth.signOut();
    router.replace('/login');
  };

  // Fetch funnel stats (reactive to roleFilter, ignores stageFilter)
  const fetchStats = useCallback(async () => {
    try {
      // 1. Applied: total candidates
      let appliedQuery = supabase.from('candidates').select('*', { count: 'exact', head: true });
      if (roleFilter !== 'all') appliedQuery = appliedQuery.eq('job_id', roleFilter);
      const { count: applied } = await appliedQuery;

      // 2. Passed CV Filter: all applied minus CV_REJECTED
      let cvRejectedQuery = supabase.from('candidates').select('*', { count: 'exact', head: true })
        .eq('status', 'CV_REJECTED');
      if (roleFilter !== 'all') cvRejectedQuery = cvRejectedQuery.eq('job_id', roleFilter);
      const { count: cvRejected } = await cvRejectedQuery;

      // 3. Invited to R1: candidates who got an invite or beyond
      // = R1 Pending + R1 Failed + R2 Pending + R2 Failed + Successful
      let invitedR1Query = supabase.from('candidates').select('*', { count: 'exact', head: true })
        .or('status.in.("INVITE_SENT","INTERVIEW_STARTED","FORM_COMPLETED"),rating.not.is.null');
      if (roleFilter !== 'all') invitedR1Query = invitedR1Query.eq('job_id', roleFilter);
      const { count: invitedR1 } = await invitedR1Query;

      // 4. Completed R1: candidates who finished R1 (have a rating)
      // = R1 Failed + R2 Pending + R2 Failed + Successful
      let completedR1Query = supabase.from('candidates').select('*', { count: 'exact', head: true })
        .not('rating', 'is', null);
      if (roleFilter !== 'all') completedR1Query = completedR1Query.eq('job_id', roleFilter);
      const { count: completedR1 } = await completedR1Query;

      // 5. Invited to R2: candidates who were invited to or completed R2
      // = R2 Pending + R2 Failed + Successful
      let invitedR2Query = supabase.from('candidates').select('*', { count: 'exact', head: true })
        .or('status.in.("ROUND_2_APPROVED","ROUND_2_INVITED"),current_stage.eq.round_2,round_2_rating.not.is.null');
      if (roleFilter !== 'all') invitedR2Query = invitedR2Query.eq('job_id', roleFilter);
      const { count: invitedR2 } = await invitedR2Query;

      // 6. Completed R2: candidates who finished R2 (have round_2_rating)
      // = R2 Failed + Successful
      let completedR2Query = supabase.from('candidates').select('*', { count: 'exact', head: true })
        .not('round_2_rating', 'is', null);
      if (roleFilter !== 'all') completedR2Query = completedR2Query.eq('job_id', roleFilter);
      const { count: completedR2 } = await completedR2Query;

      // 7. Successful: round_2_rating >= 70
      let successQuery = supabase.from('candidates').select('*', { count: 'exact', head: true })
        .not('round_2_rating', 'is', null)
        .gte('round_2_rating', 70);
      if (roleFilter !== 'all') successQuery = successQuery.eq('job_id', roleFilter);
      const { count: successful } = await successQuery;

      setStats({
        applied: applied || 0,
        passedCvFilter: (applied || 0) - (cvRejected || 0),
        invitedR1: invitedR1 || 0,
        completedR1: completedR1 || 0,
        invitedR2: invitedR2 || 0,
        completedR2: completedR2 || 0,
        successful: successful || 0,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [roleFilter]);

  // Fetch jobs (runs once on mount)
  const fetchJobs = useCallback(async () => {
    try {
      const { data: jobsData, error } = await supabase
        .from('jobs')
        .select('id, title');

      if (error) {
        console.error('Error fetching jobs:', error);
        return;
      }

      setJobs(jobsData || []);

      const map = new Map<string, string>();
      jobsData?.forEach(job => {
        map.set(job.id, job.title);
      });
      setJobMap(map);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  }, []);

  // Boolean resume search matching
  const matchesBooleanSearch = useCallback((resumeText: string | null, query: string): boolean => {
    if (!query.trim()) return true;
    if (!resumeText) return false;
    const lower = resumeText.toLowerCase();
    const clauses = parseBooleanQuery(query);
    if (clauses.length === 0) return true;

    let result = true;
    for (const clause of clauses) {
      const termMatch = lower.includes(clause.term.toLowerCase());
      if (clause.type === 'AND') result = result && termMatch;
      else if (clause.type === 'OR') result = result || termMatch;
      else if (clause.type === 'NOT') result = result && !termMatch;
    }
    return result;
  }, []);

  // Fetch candidates with pagination and filters
  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    try {
      // When Boolean resume search is active, fetch more and filter client-side
      const isBooleanActive = !!resumeSearchQuery.trim();
      const fetchLimit = isBooleanActive ? 500 : PAGE_SIZE;
      const from = isBooleanActive ? 0 : (currentPage - 1) * PAGE_SIZE;
      const to = from + fetchLimit - 1;

      let query = supabase
        .from('candidates')
        .select('id, full_name, email, rating, round_2_rating, jd_match_score, ai_summary, interview_notes, status, current_stage, interview_transcript, round_2_transcript, resume_text, resume_url, job_id, final_verdict, full_verdict, round_1_full_dossier, hr_notes, interview_token, created_at, video_url, round_2_video_url, applied_at, round_1_completed_at, round_2_completed_at', { count: isBooleanActive ? undefined : 'exact' });

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      if (roleFilter !== 'all') {
        query = query.eq('job_id', roleFilter);
      }

      if (stageFilter !== 'all') {
        switch (stageFilter) {
          case 'screening':
            query = query.is('rating', null).not('status', 'in', '("CV_REJECTED","QUESTIONNAIRE_SENT","REJECTED_VISA","INVITE_SENT","INTERVIEW_STARTED","FORM_COMPLETED")');
            break;
          case 'cv_rejected':
            query = query.eq('status', 'CV_REJECTED');
            break;
          case 'eligibility_pending':
            query = query.eq('status', 'QUESTIONNAIRE_SENT');
            break;
          case 'eligibility_failed':
            query = query.eq('status', 'REJECTED_VISA');
            break;
          case 'r1_pending':
            query = query.is('rating', null).in('status', ['INVITE_SENT', 'INTERVIEW_STARTED', 'FORM_COMPLETED']);
            break;
          case 'r1_failed':
            query = query.not('rating', 'is', null).lt('rating', 70).is('round_2_rating', null)
              .not('current_stage', 'in', '("round_2","completed")');
            break;
          case 'r2_pending':
            query = query.is('round_2_rating', null).not('rating', 'is', null)
              .or('current_stage.eq.round_2,status.eq.ROUND_2_APPROVED,status.eq.ROUND_2_INVITED,rating.gte.70');
            break;
          case 'r2_failed':
            query = query.not('round_2_rating', 'is', null).lt('round_2_rating', 70);
            break;
          case 'successful':
            query = query.not('round_2_rating', 'is', null).gte('round_2_rating', 70);
            break;
        }
      }

      // Advanced filters: score ranges
      if (cvScoreMin) query = query.gte('jd_match_score', parseInt(cvScoreMin));
      if (cvScoreMax) query = query.lte('jd_match_score', parseInt(cvScoreMax));
      if (r1ScoreMin) query = query.gte('rating', parseInt(r1ScoreMin));
      if (r1ScoreMax) query = query.lte('rating', parseInt(r1ScoreMax));
      if (r2ScoreMin) query = query.gte('round_2_rating', parseInt(r2ScoreMin));
      if (r2ScoreMax) query = query.lte('round_2_rating', parseInt(r2ScoreMax));

      // Advanced filters: date ranges
      if (appliedDateFrom) query = query.gte('applied_at', appliedDateFrom);
      if (appliedDateTo) query = query.lte('applied_at', appliedDateTo + 'T23:59:59');
      if (r1DateFrom) query = query.gte('round_1_completed_at', r1DateFrom);
      if (r1DateTo) query = query.lte('round_1_completed_at', r1DateTo + 'T23:59:59');
      if (r2DateFrom) query = query.gte('round_2_completed_at', r2DateFrom);
      if (r2DateTo) query = query.lte('round_2_completed_at', r2DateTo + 'T23:59:59');

      if (sortColumn === 'combined_score') {
        query = query
          .order('rating', { ascending: sortDirection === 'asc', nullsFirst: false })
          .order('round_2_rating', { ascending: sortDirection === 'asc', nullsFirst: false });
      } else {
        query = query.order(sortColumn, { ascending: sortDirection === 'asc', nullsFirst: false });
      }

      const { data, error, count } = await query.range(from, to);

      if (error) {
        console.error('Error fetching candidates:', error);
        return;
      }

      let results = (data || []).map(candidate => ({
        ...candidate,
        job_title: candidate.job_id ? jobMap.get(candidate.job_id) || 'Unknown Role' : undefined,
      }));

      // Apply client-side Boolean resume search
      if (isBooleanActive) {
        results = results.filter(c => matchesBooleanSearch(c.resume_text, resumeSearchQuery));
        // Client-side sort
        results.sort((a, b) => {
          const aVal = sortColumn === 'combined_score'
            ? (a.rating ?? 0) + (a.round_2_rating ?? 0)
            : a[sortColumn as keyof typeof a];
          const bVal = sortColumn === 'combined_score'
            ? (b.rating ?? 0) + (b.round_2_rating ?? 0)
            : b[sortColumn as keyof typeof b];
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return sortDirection === 'asc' ? cmp : -cmp;
        });
        const pageStart = (currentPage - 1) * PAGE_SIZE;
        const totalFiltered = results.length;
        results = results.slice(pageStart, pageStart + PAGE_SIZE);
        setCandidates(results);
        setTotalCount(totalFiltered);
      } else {
        setCandidates(results);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, resumeSearchQuery, roleFilter, stageFilter, sortColumn, sortDirection, jobMap, matchesBooleanSearch, cvScoreMin, cvScoreMax, r1ScoreMin, r1ScoreMax, r2ScoreMin, r2ScoreMax, appliedDateFrom, appliedDateTo, r1DateFrom, r1DateTo, r2DateFrom, r2DateTo]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Re-fetch stats when roleFilter changes (fetchStats has roleFilter in its deps)
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (jobMap.size > 0 || jobs.length === 0) {
      fetchCandidates();
    }
  }, [fetchCandidates, jobMap, jobs.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setResumeSearchQuery(resumeSearchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [resumeSearchInput]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, resumeSearchQuery, roleFilter, stageFilter, sortColumn, sortDirection, cvScoreMin, cvScoreMax, r1ScoreMin, r1ScoreMax, r2ScoreMin, r2ScoreMax, appliedDateFrom, appliedDateTo, r1DateFrom, r1DateTo, r2DateFrom, r2DateTo]);

  const getStageDisplay = (candidate: Candidate) => {
    // Status-based stages (most specific first)
    if (candidate.status === 'CV_REJECTED') {
      return { label: 'CV Rejected', variant: 'default' as const, className: 'bg-red-500/20 text-red-400 border-red-500/30' };
    }
    if (candidate.status === 'QUESTIONNAIRE_SENT') {
      return { label: 'Eligibility Pending', variant: 'default' as const, className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
    }
    if (candidate.status === 'REJECTED_VISA') {
      return { label: 'Eligibility Failed', variant: 'default' as const, className: 'bg-red-500/20 text-red-400 border-red-500/30' };
    }

    // R2 completed — check outcome
    if (candidate.round_2_rating !== null) {
      return candidate.round_2_rating >= 70
        ? { label: 'Successful', variant: 'default' as const, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
        : { label: 'R2 Failed', variant: 'default' as const, className: 'bg-red-500/20 text-red-400 border-red-500/30' };
    }

    // In R2 pipeline but no score yet
    if (candidate.current_stage === 'round_2' || candidate.status === 'ROUND_2_INVITED' || candidate.status === 'ROUND_2_APPROVED') {
      return { label: 'R2 Pending', variant: 'default' as const, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    }

    // R1 completed — check outcome
    if (candidate.rating !== null) {
      if (candidate.rating >= 70) {
        // Passed R1, auto-invite to R2 scheduled
        return { label: 'R2 Pending', variant: 'default' as const, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      }
      return { label: 'R1 Failed', variant: 'default' as const, className: 'bg-red-500/20 text-red-400 border-red-500/30' };
    }

    // R1 invite sent but not taken
    if (['INVITE_SENT', 'INTERVIEW_STARTED', 'FORM_COMPLETED'].includes(candidate.status)) {
      return { label: 'R1 Pending', variant: 'default' as const, className: 'bg-sky-500/20 text-sky-400 border-sky-500/30' };
    }

    // Default — in screening pipeline
    return { label: 'Screening', variant: 'secondary' as const, className: '' };
  };

  const ScoreBar = ({ score, label, color }: { score: number | null, label: string, color: string }) => {
    if (score === null) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">{label}</span>
          <div className="w-16 h-2 bg-muted rounded-full" />
          <span className="text-xs text-muted-foreground">—</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-12">{label}</span>
        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-semibold ${score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
          {score}
        </span>
      </div>
    );
  };

  const handleGenerateNotes = async () => {
    if (!selectedCandidate) return;
    setGeneratingNotes(true);
    try {
      const notes = await generateInterviewNotes({
        candidateId: selectedCandidate.id,
        candidateName: selectedCandidate.full_name,
        jobTitle: selectedCandidate.job_title,
        round1Transcript: selectedCandidate.interview_transcript,
        round2Transcript: selectedCandidate.round_2_transcript,
      });
      setInterviewNotes(notes);
      // Update local candidate state so notes persist if modal is reopened
      setCandidates(prev => prev.map(c =>
        c.id === selectedCandidate.id ? { ...c, interview_notes: notes } : c
      ));
    } catch (err) {
      console.error('Notes generation failed:', err);
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleSendInvite = async (candidateId: number) => {
    setSendingInvite(candidateId);
    const result = await sendInterviewInvite(candidateId);
    if (result.success) {
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, status: 'INVITE_SENT' } : c
      ));
    } else {
      setToastModal({ title: 'Failed to Send Invite', description: result.error || 'An unexpected error occurred.', variant: 'error' });
    }
    setSendingInvite(null);
  };

  const handleInviteRound2 = async (candidateId: number) => {
    setSendingInvite(candidateId);
    const result = await inviteToRound2(candidateId);
    if (result.success) {
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, current_stage: 'round_2', status: 'ROUND_2_INVITED' } : c
      ));
    } else {
      setToastModal({ title: 'Failed to Invite', description: result.error || 'An unexpected error occurred.', variant: 'error' });
    }
    setSendingInvite(null);
  };

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUp className="w-3 h-3 text-muted-foreground/40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-emerald-400" />
      : <ArrowDown className="w-3 h-3 text-emerald-400" />;
  };

  const handleAdvance = async (candidateId: number) => {
    setSavingDecision(true);
    const { error } = await supabase
      .from('candidates')
      .update({ final_verdict: 'Hired', status: 'HIRED' })
      .eq('id', candidateId);
    if (!error) {
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, final_verdict: 'Hired', status: 'HIRED' } : c
      ));
      if (selectedCandidate?.id === candidateId) {
        setSelectedCandidate(prev => prev ? { ...prev, final_verdict: 'Hired', status: 'HIRED' } : null);
      }
    }
    setSavingDecision(false);
  };

  const handleReject = async (candidateId: number) => {
    setSavingDecision(true);
    const { error } = await supabase
      .from('candidates')
      .update({ final_verdict: 'Rejected', status: 'REJECTED' })
      .eq('id', candidateId);
    if (!error) {
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, final_verdict: 'Rejected', status: 'REJECTED' } : c
      ));
      if (selectedCandidate?.id === candidateId) {
        setSelectedCandidate(prev => prev ? { ...prev, final_verdict: 'Rejected', status: 'REJECTED' } : null);
      }
    }
    setSavingDecision(false);
  };

  const handleSaveNote = async (candidateId: number) => {
    setSavingNote(true);
    const { error } = await supabase
      .from('candidates')
      .update({ hr_notes: noteText })
      .eq('id', candidateId);
    if (!error) {
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, hr_notes: noteText } : c
      ));
      if (selectedCandidate?.id === candidateId) {
        setSelectedCandidate(prev => prev ? { ...prev, hr_notes: noteText } : null);
      }
    }
    setSavingNote(false);
  };

  const handleRevertStage = (candidate: Candidate) => {
    let updateFields: Record<string, unknown>;
    let confirmMsg: string;

    if (candidate.round_2_rating !== null) {
      confirmMsg = `Revert ${candidate.full_name} from R2 completed back to R2 Invited? This clears their Round 2 score and verdict so they can retake the technical interview.`;
      updateFields = {
        round_2_rating: null,
        round_2_transcript: null,
        round_2_video_url: null,
        full_verdict: null,
        final_verdict: null,
        status: 'ROUND_2_INVITED',
        current_stage: 'round_2',
      };
    } else if (candidate.current_stage === 'round_2' || candidate.status === 'ROUND_2_INVITED' || candidate.status === 'ROUND_2_APPROVED') {
      confirmMsg = `Revert ${candidate.full_name} from R2 pipeline back to R1 Invite Sent? This clears their Round 1 score and all Round 2 data so they can retake the personality interview.`;
      updateFields = {
        rating: null,
        interview_transcript: null,
        video_url: null,
        ai_summary: null,
        interview_notes: null,
        round_1_dossier: null,
        round_1_full_dossier: null,
        round_2_invite_after: null,
        round_2_rating: null,
        round_2_transcript: null,
        round_2_video_url: null,
        full_verdict: null,
        final_verdict: null,
        status: 'INVITE_SENT',
        current_stage: null,
      };
    } else if (candidate.rating !== null) {
      confirmMsg = `Revert ${candidate.full_name} from R1 completed back to R1 Invite Sent? This clears their Round 1 score so they can retake the personality interview.`;
      updateFields = {
        rating: null,
        interview_transcript: null,
        video_url: null,
        ai_summary: null,
        interview_notes: null,
        round_1_dossier: null,
        round_1_full_dossier: null,
        round_2_invite_after: null,
        status: 'INVITE_SENT',
        current_stage: null,
      };
    } else {
      return;
    }

    setBulkModal({
      phase: 'confirm',
      title: 'Revert Candidate Stage',
      description: confirmMsg,
      variant: 'destructive',
      processed: 0, total: 1, succeeded: 0,
      onConfirm: async () => {
        setBulkModal(prev => prev ? { ...prev, phase: 'progress', currentName: candidate.full_name } : prev);
        setRevertingCandidate(candidate.id);
        const { error } = await supabase
          .from('candidates')
          .update(updateFields)
          .eq('id', candidate.id);

        if (error) {
          setBulkModal(prev => prev ? { ...prev, phase: 'done', processed: 1, resultTitle: 'Revert Failed', resultDescription: error.message, resultVariant: 'error' } : prev);
        } else {
          setCandidates(prev => prev.map(c =>
            c.id === candidate.id ? { ...c, ...updateFields } as Candidate : c
          ));
          if (selectedCandidate?.id === candidate.id) {
            setSelectedCandidate(prev => prev ? { ...prev, ...updateFields } as Candidate : null);
          }
          setBulkModal(prev => prev ? { ...prev, phase: 'done', processed: 1, succeeded: 1, resultTitle: 'Stage Reverted', resultDescription: `${candidate.full_name} has been reverted successfully.`, resultVariant: 'success' } : prev);
        }
        setRevertingCandidate(null);
      },
    });
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // Bulk selection helpers
  const toggleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCandidates = candidates.filter(c => selectedIds.has(c.id));

  // Helper: run a bulk operation with progress tracking inside the modal
  const runBulkWithProgress = async (
    eligible: Candidate[],
    title: string,
    processFn: (candidate: Candidate) => Promise<boolean>,
    doneTitle: string,
  ) => {
    setBulkActionLoading(true);
    let succeeded = 0;
    for (let i = 0; i < eligible.length; i++) {
      const c = eligible[i];
      setBulkModal(prev => prev ? { ...prev, phase: 'progress', processed: i, currentName: c.full_name } : prev);
      try {
        const ok = await processFn(c);
        if (ok) succeeded++;
      } catch (e) {
        console.error(`Bulk action failed for ${c.email}:`, e);
      }
      setBulkModal(prev => prev ? { ...prev, processed: i + 1, succeeded } : prev);
    }
    setBulkActionLoading(false);
    setSelectedIds(new Set());
    setBulkModal(prev => prev ? {
      ...prev,
      phase: 'done',
      resultTitle: doneTitle,
      resultDescription: `${succeeded} of ${eligible.length} candidate(s) processed successfully.`,
      resultVariant: succeeded > 0 ? 'success' : 'error',
    } : prev);
    fetchStats();
    fetchCandidates();
  };

  // Bulk action handlers
  const handleBulkSendR1 = () => {
    const eligible = selectedCandidates.filter(c =>
      c.rating === null && !['INVITE_SENT', 'INTERVIEW_STARTED', 'FORM_COMPLETED'].includes(c.status)
    );
    if (eligible.length === 0) {
      setToastModal({ title: 'No Eligible Candidates', description: 'None of the selected candidates are eligible for an R1 invite.', variant: 'error' });
      return;
    }
    setBulkModal({
      phase: 'confirm',
      title: 'Send Round 1 Invites',
      description: `Send R1 interview invite to ${eligible.length} candidate(s)? This includes any overrides for CV Rejected / Eligibility statuses.`,
      processed: 0, total: eligible.length, succeeded: 0,
      onConfirm: () => runBulkWithProgress(eligible, 'Sending R1 Invites', async (c) => {
        const result = await sendInterviewInvite(c.id);
        return result.success;
      }, 'R1 Invites Sent'),
    });
  };

  const handleBulkSendR2 = () => {
    const eligible = selectedCandidates.filter(c =>
      c.rating !== null &&
      c.round_2_rating === null &&
      c.current_stage !== 'round_2' &&
      c.current_stage !== 'completed' &&
      c.status !== 'ROUND_2_INVITED' &&
      c.status !== 'ROUND_2_APPROVED'
    );
    if (eligible.length === 0) {
      setToastModal({ title: 'No Eligible Candidates', description: 'None of the selected candidates are eligible for an R2 invite.', variant: 'error' });
      return;
    }
    setBulkModal({
      phase: 'confirm',
      title: 'Invite to Round 2',
      description: `Invite ${eligible.length} candidate(s) to Round 2? This includes any overrides for R1 Failed candidates.`,
      processed: 0, total: eligible.length, succeeded: 0,
      onConfirm: () => runBulkWithProgress(eligible, 'Inviting to Round 2', async (c) => {
        const result = await inviteToRound2(c.id);
        return result.success;
      }, 'R2 Invites Sent'),
    });
  };

  const handleBulkAdvance = () => {
    const eligible = selectedCandidates.filter(c => c.rating !== null && c.final_verdict !== 'Hired');
    if (eligible.length === 0) {
      setToastModal({ title: 'No Eligible Candidates', description: 'None of the selected candidates are eligible to advance.', variant: 'error' });
      return;
    }
    setBulkModal({
      phase: 'confirm',
      title: 'Advance Candidates',
      description: `Mark ${eligible.length} candidate(s) as Hired?`,
      processed: 0, total: eligible.length, succeeded: 0,
      onConfirm: () => runBulkWithProgress(eligible, 'Advancing Candidates', async (c) => {
        const { error } = await supabase.from('candidates').update({ final_verdict: 'Hired', status: 'HIRED' }).eq('id', c.id);
        return !error;
      }, 'Candidates Advanced'),
    });
  };

  const handleBulkReject = () => {
    const eligible = selectedCandidates.filter(c => c.rating !== null && c.final_verdict !== 'Rejected');
    if (eligible.length === 0) {
      setToastModal({ title: 'No Eligible Candidates', description: 'None of the selected candidates are eligible to reject.', variant: 'error' });
      return;
    }
    setBulkModal({
      phase: 'confirm',
      title: 'Reject Candidates',
      description: `Mark ${eligible.length} candidate(s) as Rejected? This cannot be easily undone.`,
      variant: 'destructive',
      processed: 0, total: eligible.length, succeeded: 0,
      onConfirm: () => runBulkWithProgress(eligible, 'Rejecting Candidates', async (c) => {
        const { error } = await supabase.from('candidates').update({ final_verdict: 'Rejected', status: 'REJECTED' }).eq('id', c.id);
        return !error;
      }, 'Candidates Rejected'),
    });
  };

  const activeAdvancedFilterCount = [cvScoreMin, cvScoreMax, r1ScoreMin, r1ScoreMax, r2ScoreMin, r2ScoreMax, appliedDateFrom, appliedDateTo, r1DateFrom, r1DateTo, r2DateFrom, r2DateTo].filter(Boolean).length;

  const clearAdvancedFilters = () => {
    setCvScoreMin(''); setCvScoreMax('');
    setR1ScoreMin(''); setR1ScoreMax('');
    setR2ScoreMin(''); setR2ScoreMax('');
    setAppliedDateFrom(''); setAppliedDateTo('');
    setR1DateFrom(''); setR1DateTo('');
    setR2DateFrom(''); setR2DateTo('');
  };

  const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, totalCount);

  // Don't render until auth is confirmed
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.jpg"
              alt="Printerpix"
              width={48}
              height={48}
              className="rounded-xl ring-1 ring-border"
            />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Talent Pipeline</h1>
              <p className="text-muted-foreground text-sm">2-Round AI Interview Leaderboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild className="bg-emerald-600 hover:bg-emerald-500 text-white">
              <Link href="/gen-job">
                <Plus className="w-4 h-4 mr-2" />
                Create Job
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/jobs">
                <Briefcase className="w-4 h-4 mr-2" />
                Manage Jobs
              </Link>
            </Button>
            <Button variant="outline" asChild className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              <Link href="/screener">
                <Zap className="w-4 h-4 mr-2" />
                Bulk Screener
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/prompts">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                AI Prompts
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-8 mx-1" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleLogout}>
                    <LogOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign out</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Funnel Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <Card className="border-l-4 border-l-muted-foreground/40">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-muted-foreground text-xs">Applied</p>
              </div>
              <p className="text-2xl font-bold">{stats.applied}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-violet-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5 text-violet-400" />
                <p className="text-muted-foreground text-xs">Passed CV Filter</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-bold text-violet-400">{stats.passedCvFilter}</p>
                {stats.applied > 0 && (
                  <span className="text-[10px] text-muted-foreground">{Math.round((stats.passedCvFilter / stats.applied) * 100)}%</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-sky-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Send className="w-3.5 h-3.5 text-sky-400" />
                <p className="text-muted-foreground text-xs">Invited to R1</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-bold text-sky-400">{stats.invitedR1}</p>
                {stats.applied > 0 && (
                  <span className="text-[10px] text-muted-foreground">{Math.round((stats.invitedR1 / stats.applied) * 100)}%</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <p className="text-muted-foreground text-xs">Completed R1</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-bold text-cyan-400">{stats.completedR1}</p>
                {stats.applied > 0 && (
                  <span className="text-[10px] text-muted-foreground">{Math.round((stats.completedR1 / stats.applied) * 100)}%</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                <p className="text-muted-foreground text-xs">Invited to R2</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-bold text-blue-400">{stats.invitedR2}</p>
                {stats.applied > 0 && (
                  <span className="text-[10px] text-muted-foreground">{Math.round((stats.invitedR2 / stats.applied) * 100)}%</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-indigo-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <p className="text-muted-foreground text-xs">Completed R2</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-bold text-indigo-400">{stats.completedR2}</p>
                {stats.applied > 0 && (
                  <span className="text-[10px] text-muted-foreground">{Math.round((stats.completedR2 / stats.applied) * 100)}%</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-muted-foreground text-xs">Successful</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-bold text-emerald-400">{stats.successful}</p>
                {stats.applied > 0 && (
                  <span className="text-[10px] text-muted-foreground">{Math.round((stats.successful / stats.applied) * 100)}%</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-72"
            />
          </div>

          <div className="w-px h-6 bg-border" />

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground text-sm">Filters:</span>
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {jobs.map(job => (
                <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="screening">Screening</SelectItem>
              <SelectItem value="cv_rejected">CV Rejected</SelectItem>
              <SelectItem value="eligibility_pending">Eligibility Pending</SelectItem>
              <SelectItem value="eligibility_failed">Eligibility Failed</SelectItem>
              <SelectItem value="r1_pending">R1 Pending</SelectItem>
              <SelectItem value="r1_failed">R1 Failed</SelectItem>
              <SelectItem value="r2_pending">R2 Pending</SelectItem>
              <SelectItem value="r2_failed">R2 Failed</SelectItem>
              <SelectItem value="successful">Successful</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={showAdvancedFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowAdvancedFilters(prev => !prev)}
            className="ml-auto"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
            Advanced
            {activeAdvancedFilterCount > 0 && (
              <Badge className="ml-1.5 bg-emerald-500/20 text-emerald-400 px-1.5 py-0 text-xs">
                {activeAdvancedFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="mb-6 space-y-4 p-4 border border-border rounded-lg bg-muted/30">
            {/* Score Ranges */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Score Ranges</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-6">CV</span>
                  <Input type="number" placeholder="Min" value={cvScoreMin} onChange={e => setCvScoreMin(e.target.value)} className="w-20 h-8 text-sm" min={0} max={100} />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="number" placeholder="Max" value={cvScoreMax} onChange={e => setCvScoreMax(e.target.value)} className="w-20 h-8 text-sm" min={0} max={100} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-6">R1</span>
                  <Input type="number" placeholder="Min" value={r1ScoreMin} onChange={e => setR1ScoreMin(e.target.value)} className="w-20 h-8 text-sm" min={0} max={100} />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="number" placeholder="Max" value={r1ScoreMax} onChange={e => setR1ScoreMax(e.target.value)} className="w-20 h-8 text-sm" min={0} max={100} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-6">R2</span>
                  <Input type="number" placeholder="Min" value={r2ScoreMin} onChange={e => setR2ScoreMin(e.target.value)} className="w-20 h-8 text-sm" min={0} max={100} />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="number" placeholder="Max" value={r2ScoreMax} onChange={e => setR2ScoreMax(e.target.value)} className="w-20 h-8 text-sm" min={0} max={100} />
                </div>
              </div>
            </div>

            {/* Date Ranges */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Date Ranges</span>
                <div className="flex items-center gap-1.5 ml-4">
                  <Button variant="outline" size="sm" className="h-6 text-xs px-2"
                    onClick={() => {
                      const d = new Date(); d.setDate(d.getDate() - 7);
                      setAppliedDateFrom(d.toISOString().split('T')[0]);
                      setAppliedDateTo(new Date().toISOString().split('T')[0]);
                    }}>
                    Last 7d
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 text-xs px-2"
                    onClick={() => {
                      const d = new Date(); d.setDate(d.getDate() - 30);
                      setAppliedDateFrom(d.toISOString().split('T')[0]);
                      setAppliedDateTo(new Date().toISOString().split('T')[0]);
                    }}>
                    Last 30d
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-14">Applied</span>
                  <input type="date" value={appliedDateFrom} onChange={e => setAppliedDateFrom(e.target.value)}
                    className="h-8 px-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input type="date" value={appliedDateTo} onChange={e => setAppliedDateTo(e.target.value)}
                    className="h-8 px-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-14">R1 Date</span>
                  <input type="date" value={r1DateFrom} onChange={e => setR1DateFrom(e.target.value)}
                    className="h-8 px-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input type="date" value={r1DateTo} onChange={e => setR1DateTo(e.target.value)}
                    className="h-8 px-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-14">R2 Date</span>
                  <input type="date" value={r2DateFrom} onChange={e => setR2DateFrom(e.target.value)}
                    className="h-8 px-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input type="date" value={r2DateTo} onChange={e => setR2DateTo(e.target.value)}
                    className="h-8 px-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            </div>

            {/* Clear All */}
            {activeAdvancedFilterCount > 0 && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearAdvancedFilters} className="text-muted-foreground h-7 text-xs">
                  <X className="w-3 h-3 mr-1" />
                  Clear Advanced Filters
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Boolean Resume Search */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <FileText className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder='Boolean resume search — e.g. Python AND React NOT Java, "machine learning" OR AI'
                value={resumeSearchInput}
                onChange={(e) => setResumeSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            {resumeSearchQuery && (
              <Badge variant="secondary" className="shrink-0">
                {parseBooleanQuery(resumeSearchQuery).length} term{parseBooleanQuery(resumeSearchQuery).length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {resumeSearchInput && !resumeSearchQuery && (
            <p className="text-xs text-muted-foreground mt-1 ml-1">Searching...</p>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"><div className="h-4 w-4 bg-muted rounded animate-pulse" /></TableHead>
                      <TableHead className="w-12"><div className="h-4 w-6 bg-muted rounded animate-pulse" /></TableHead>
                      <TableHead><div className="h-4 w-24 bg-muted rounded animate-pulse" /></TableHead>
                      <TableHead><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableHead>
                      <TableHead><div className="h-4 w-14 bg-muted rounded animate-pulse" /></TableHead>
                      <TableHead><div className="h-4 w-14 bg-muted rounded animate-pulse" /></TableHead>
                      <TableHead><div className="h-4 w-14 bg-muted rounded animate-pulse" /></TableHead>
                      <TableHead><div className="h-4 w-8 bg-muted rounded animate-pulse" /></TableHead>
                      <TableHead><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableHead>
                      <TableHead><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableHead>
                      <TableHead><div className="h-4 w-14 bg-muted rounded animate-pulse" /></TableHead>
                      <TableHead><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="h-4 w-4 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-6 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                            <div className="h-3 w-40 bg-muted/60 rounded animate-pulse" />
                          </div>
                        </TableCell>
                        <TableCell><div className="h-4 w-24 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-12 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-12 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-12 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-5 w-8 bg-muted rounded-full animate-pulse" /></TableCell>
                        <TableCell><div className="h-5 w-16 bg-muted rounded-full animate-pulse" /></TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <div className="h-2 w-20 bg-muted rounded-full animate-pulse" />
                            <div className="h-2 w-20 bg-muted rounded-full animate-pulse" />
                          </div>
                        </TableCell>
                        <TableCell><div className="h-5 w-14 bg-muted rounded-full animate-pulse" /></TableCell>
                        <TableCell><div className="h-8 w-8 bg-muted rounded-md animate-pulse" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <>
                {/* Bulk Action Bar */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b">
                    <span className="text-sm font-medium">{selectedIds.size} selected</span>
                    <div className="w-px h-5 bg-border" />
                    <Button size="sm" variant="outline" onClick={handleBulkSendR1} disabled={bulkActionLoading}
                      className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/30">
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Send R1 Invite
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBulkSendR2} disabled={bulkActionLoading}
                      className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/30">
                      <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                      Invite to R2
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBulkAdvance} disabled={bulkActionLoading}
                      className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Advance
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBulkReject} disabled={bulkActionLoading}
                      className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-500/30">
                      <XCircle className="w-3.5 h-3.5 mr-1.5" />
                      Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="ml-auto text-muted-foreground">
                      Clear
                    </Button>
                    {bulkActionLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  </div>
                )}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={candidates.length > 0 && selectedIds.size === candidates.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('created_at')}>
                        <div className="flex items-center gap-1">
                          Applied
                          <SortIcon column="created_at" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('round_1_completed_at')}>
                        <div className="flex items-center gap-1">
                          R1 Date
                          <SortIcon column="round_1_completed_at" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('round_2_completed_at')}>
                        <div className="flex items-center gap-1">
                          R2 Date
                          <SortIcon column="round_2_completed_at" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('jd_match_score')}>
                        <div className="flex items-center gap-1">
                          CV
                          <SortIcon column="jd_match_score" />
                        </div>
                      </TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('combined_score')}>
                        <div className="flex items-center gap-1">
                          Scores
                          <SortIcon column="combined_score" />
                        </div>
                      </TableHead>
                      <TableHead>Verdict</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((candidate, index) => {
                      const stageDisplay = getStageDisplay(candidate);
                      // R1 invite: show for any candidate without R1 rating who doesn't already have an active invite
                      const canSendInvite = candidate.rating === null &&
                        !['INVITE_SENT', 'INTERVIEW_STARTED', 'FORM_COMPLETED'].includes(candidate.status);
                      // R2 invite: show for any R1-completed candidate not already in R2 (enables override for R1 Failed)
                      const canInviteR2 = candidate.rating !== null &&
                        candidate.round_2_rating === null &&
                        candidate.current_stage !== 'round_2' &&
                        candidate.current_stage !== 'completed' &&
                        candidate.status !== 'ROUND_2_INVITED' &&
                        candidate.status !== 'ROUND_2_APPROVED';
                      // Override detection for visual distinction
                      const isR1Override = canSendInvite && ['CV_REJECTED', 'QUESTIONNAIRE_SENT', 'REJECTED_VISA'].includes(candidate.status);
                      const isR2Override = canInviteR2 && candidate.rating !== null && candidate.rating < 70;
                      const rowNumber = startIndex + index;

                      return (
                        <TableRow key={candidate.id} className={`transition-colors duration-150 ${selectedIds.has(candidate.id) ? 'bg-muted/30' : ''}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(candidate.id)}
                              onCheckedChange={() => toggleSelect(candidate.id)}
                              aria-label={`Select ${candidate.full_name}`}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground font-medium">
                            {rowNumber}
                          </TableCell>

                          <TableCell>
                            <div>
                              <p className="font-medium">{candidate.full_name}</p>
                              <p className="text-muted-foreground text-sm">{candidate.email}</p>
                            </div>
                          </TableCell>

                          <TableCell className="text-sm">
                            {candidate.job_title || '—'}
                          </TableCell>

                          <TableCell className="text-muted-foreground text-sm">
                            {candidate.created_at
                              ? new Date(candidate.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                              : '—'}
                          </TableCell>

                          <TableCell className="text-muted-foreground text-sm">
                            {candidate.round_1_completed_at
                              ? new Date(candidate.round_1_completed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                              : '—'}
                          </TableCell>

                          <TableCell className="text-muted-foreground text-sm">
                            {candidate.round_2_completed_at
                              ? new Date(candidate.round_2_completed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                              : '—'}
                          </TableCell>

                          <TableCell>
                            {candidate.jd_match_score !== null ? (
                              <Badge className={`${
                                candidate.jd_match_score >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                                candidate.jd_match_score >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {candidate.jd_match_score}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge variant={stageDisplay.variant} className={`whitespace-nowrap ${stageDisplay.className}`}>
                              {stageDisplay.label}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1">
                              <ScoreBar
                                score={candidate.rating}
                                label="Hunger"
                                color={candidate.rating && candidate.rating >= 70 ? 'bg-emerald-500' : candidate.rating && candidate.rating >= 50 ? 'bg-yellow-500' : 'bg-red-500'}
                              />
                              <ScoreBar
                                score={candidate.round_2_rating}
                                label="Skills"
                                color={candidate.round_2_rating && candidate.round_2_rating >= 70 ? 'bg-blue-500' : candidate.round_2_rating && candidate.round_2_rating >= 50 ? 'bg-yellow-500' : 'bg-red-500'}
                              />
                            </div>
                          </TableCell>

                          <TableCell>
                            {candidate.final_verdict === 'Hired' ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400">Advanced</Badge>
                            ) : candidate.final_verdict === 'Rejected' ? (
                              <Badge className="bg-red-500/20 text-red-400">Rejected</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="secondary"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setSelectedCandidate(candidate)}
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View Details</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {(candidate.video_url || candidate.round_2_video_url) && (
                                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" title="Has recording" />
                              )}

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {canSendInvite && (
                                    <DropdownMenuItem
                                      onClick={() => handleSendInvite(candidate.id)}
                                      disabled={sendingInvite === candidate.id}
                                      className={isR1Override ? 'text-amber-400' : 'text-blue-400'}
                                    >
                                      <Send className="w-3.5 h-3.5 mr-2" />
                                      {isR1Override ? 'Override: Send R1 Invite' : 'Send R1 Invite'}
                                    </DropdownMenuItem>
                                  )}

                                  {canInviteR2 && (
                                    <DropdownMenuItem
                                      onClick={() => handleInviteRound2(candidate.id)}
                                      disabled={sendingInvite === candidate.id}
                                      className={isR2Override ? 'text-amber-400' : 'text-emerald-400'}
                                    >
                                      <ArrowRight className="w-3.5 h-3.5 mr-2" />
                                      {isR2Override ? 'Override: Invite to R2' : 'Invite to Round 2'}
                                    </DropdownMenuItem>
                                  )}

                                  {(canSendInvite || canInviteR2) && candidate.rating !== null && (
                                    <DropdownMenuSeparator />
                                  )}

                                  {candidate.rating !== null && (
                                    <DropdownMenuItem
                                      onClick={() => handleRevertStage(candidate)}
                                      disabled={revertingCandidate === candidate.id}
                                      className="text-orange-400"
                                    >
                                      {revertingCandidate === candidate.id ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                                      ) : (
                                        <RotateCcw className="w-3.5 h-3.5 mr-2" />
                                      )}
                                      Revert Stage
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {candidates.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <SearchX className="w-12 h-12 mb-4 opacity-40" />
                    <p className="font-medium">No candidates found</p>
                    <p className="text-sm mt-1">Try adjusting your filters or search terms</p>
                  </div>
                )}
              </>
            )}

            {/* Pagination */}
            {totalCount > 0 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-muted-foreground text-sm">
                  Showing {startIndex} - {endIndex} of {totalCount} candidates
                </p>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    title="First page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {getPageNumbers().map((page, idx) => (
                    <Button
                      key={idx}
                      variant={page === currentPage ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => typeof page === 'number' && goToPage(page)}
                      disabled={page === '...'}
                      className={page === currentPage ? 'bg-emerald-600 hover:bg-emerald-500' : ''}
                    >
                      {page}
                    </Button>
                  ))}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    title="Last page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedCandidate} onOpenChange={(open) => { if (!open) { setSelectedCandidate(null); setInterviewNotes(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {/* Status color bar at top */}
          {(() => {
            const stage = selectedCandidate ? getStageDisplay(selectedCandidate) : null;
            const barColor = stage?.className?.includes('emerald') ? 'bg-emerald-500' :
              stage?.className?.includes('blue') ? 'bg-blue-500' :
              stage?.className?.includes('sky') ? 'bg-sky-500' :
              stage?.className?.includes('red') ? 'bg-red-500' :
              stage?.className?.includes('orange') ? 'bg-orange-500' :
              'bg-muted-foreground';
            return <div className={`h-1 w-full ${barColor} rounded-t-lg shrink-0`} />;
          })()}

          <div className="px-6 pt-5 pb-0">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center ring-2 ring-emerald-500/30">
                  <span className="text-emerald-400 font-bold text-lg">
                    {selectedCandidate?.full_name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl">{selectedCandidate?.full_name}</DialogTitle>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-muted-foreground text-sm">{selectedCandidate?.job_title || 'No role specified'}</p>
                    {selectedCandidate && (
                      <Badge variant={getStageDisplay(selectedCandidate).variant} className={`text-[10px] px-1.5 py-0 ${getStageDisplay(selectedCandidate).className}`}>
                        {getStageDisplay(selectedCandidate).label}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 space-y-6 px-6 pb-6 pt-4">
            {/* Radial Score Gauges */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Round 1: Hunger', score: selectedCandidate?.rating ?? null, color: 'emerald' },
                { label: 'Round 2: Skills', score: selectedCandidate?.round_2_rating ?? null, color: 'blue' },
              ].map(({ label, score, color }) => {
                const pct = score !== null ? score : 0;
                const circumference = 2 * Math.PI * 40;
                const strokeDashoffset = circumference - (pct / 100) * circumference;
                const strokeColor = score === null ? 'stroke-muted' :
                  score >= 70 ? (color === 'blue' ? 'stroke-blue-500' : 'stroke-emerald-500') :
                  score >= 50 ? 'stroke-yellow-500' : 'stroke-red-500';
                const textColor = score === null ? 'text-muted-foreground' :
                  score >= 70 ? (color === 'blue' ? 'text-blue-400' : 'text-emerald-400') :
                  score >= 50 ? 'text-yellow-400' : 'text-red-400';

                return (
                  <Card key={label}>
                    <CardContent className="pt-4 flex items-center gap-4">
                      <div className="relative w-20 h-20 shrink-0">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 96 96">
                          <circle cx="48" cy="48" r="40" fill="none" strokeWidth="6" className="stroke-muted" />
                          {score !== null && (
                            <circle
                              cx="48" cy="48" r="40" fill="none" strokeWidth="6"
                              className={strokeColor}
                              strokeLinecap="round"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffset}
                              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                            />
                          )}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-lg font-bold ${textColor}`}>
                            {score !== null ? score : '—'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm">{label}</p>
                        <p className={`text-sm font-medium mt-0.5 ${textColor}`}>
                          {score !== null ? (score >= 70 ? 'Passed' : score >= 50 ? 'Borderline' : 'Below threshold') : 'Pending'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Separator />

            {/* Final Verdict */}
            {selectedCandidate?.final_verdict && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-muted-foreground text-sm mb-1">Final Verdict</p>
                  <p className={`text-2xl font-bold ${
                    selectedCandidate.final_verdict === 'Hired' ? 'text-emerald-400' :
                    selectedCandidate.final_verdict.includes('Strong') ? 'text-emerald-400' :
                    selectedCandidate.final_verdict === 'Hire' ? 'text-blue-400' :
                    selectedCandidate.final_verdict === 'Rejected' ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {selectedCandidate.final_verdict}
                  </p>
                  {/* Expanded verdict details from Round 2 */}
                  {selectedCandidate.full_verdict && (
                    <div className="mt-4 space-y-3 border-t border-border pt-3">
                      <p className="text-sm">{selectedCandidate.full_verdict.summary}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-emerald-400 mb-1">Technical Strengths</p>
                          <ul className="space-y-0.5">
                            {selectedCandidate.full_verdict.technicalStrengths.map((s, i) => (
                              <li key={i} className="text-xs flex items-start gap-1.5">
                                <span className="text-emerald-400 mt-0.5">+</span>{s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-red-400 mb-1">Technical Gaps</p>
                          <ul className="space-y-0.5">
                            {selectedCandidate.full_verdict.technicalGaps.map((g, i) => (
                              <li key={i} className="text-xs flex items-start gap-1.5">
                                <span className="text-red-400 mt-0.5">-</span>{g}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Recommendation:</span> {selectedCandidate.full_verdict.recommendation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Interview Notes */}
            {(selectedCandidate?.interview_transcript || selectedCandidate?.round_2_transcript) && <Separator />}
            {(selectedCandidate?.interview_transcript || selectedCandidate?.round_2_transcript) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <NotebookPen className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-semibold">Interview Notes</h3>
                  </div>
                  {!interviewNotes && (
                    <Button
                      size="sm"
                      onClick={handleGenerateNotes}
                      disabled={generatingNotes}
                      className="bg-emerald-600 hover:bg-emerald-500"
                    >
                      {generatingNotes ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                          Generate Notes
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {interviewNotes && (
                  <div className="space-y-4">
                    {/* Summary — combined impression + recommendation */}
                    <Card className="border-emerald-500/30">
                      <CardContent className="pt-4">
                        <p className="text-sm font-medium text-emerald-400 mb-2">Summary</p>
                        <p className="text-sm leading-relaxed">
                          {interviewNotes.overallImpression} {interviewNotes.recommendation}
                        </p>
                      </CardContent>
                    </Card>

                    {/* Strengths & Concerns */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-sm font-medium text-emerald-400 mb-2">Strengths</p>
                          <ul className="space-y-1">
                            {interviewNotes.strengths.map((s, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="text-emerald-400 mt-0.5">+</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-sm font-medium text-red-400 mb-2">Concerns</p>
                          <ul className="space-y-1">
                            {interviewNotes.concerns.map((c, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="text-red-400 mt-0.5">-</span>
                                {c}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Technical + Culture */}
                    <div className="grid grid-cols-2 gap-4">
                      {interviewNotes.technicalAssessment && (
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-sm font-medium text-blue-400 mb-1">Technical Assessment</p>
                            <p className="text-sm">{interviewNotes.technicalAssessment}</p>
                          </CardContent>
                        </Card>
                      )}
                      <Card className={interviewNotes.technicalAssessment ? '' : 'col-span-2'}>
                        <CardContent className="pt-4">
                          <p className="text-sm font-medium text-purple-400 mb-1">Culture Fit</p>
                          <p className="text-sm">{interviewNotes.cultureFit}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Follow-up Questions */}
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm font-medium text-yellow-400 mb-2">Follow-up Questions</p>
                        <ul className="space-y-1">
                          {interviewNotes.followUpQuestions.map((q, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-yellow-400 mt-0.5">{i + 1}.</span>
                              {q}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {!interviewNotes && !generatingNotes && (
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4 text-center py-6">
                      <p className="text-sm text-muted-foreground">Click &quot;Generate Notes&quot; to create AI-powered interview notes from the transcript.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Video Recordings */}
            {(selectedCandidate?.video_url || selectedCandidate?.round_2_video_url || selectedCandidate?.interview_transcript || selectedCandidate?.round_2_transcript) && <Separator />}
            {(selectedCandidate?.video_url || selectedCandidate?.round_2_video_url || selectedCandidate?.interview_transcript || selectedCandidate?.round_2_transcript) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Video className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-semibold">Interview Recordings</h3>
                </div>
                <div className="space-y-4">
                  {/* Round 1 */}
                  {selectedCandidate?.interview_transcript && (
                    selectedCandidate.video_url ? (
                      <Card>
                        <CardContent className="pt-4">
                          <VideoPlayer
                            src={selectedCandidate.video_url}
                            title="Round 1 Recording"
                          />
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardContent className="pt-4 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Round 1 recording not yet assembled</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStitchRecording(1)}
                            disabled={stitchingRound !== null}
                          >
                            {stitchingRound === 1 ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Stitching…</>
                            ) : (
                              <><RotateCcw className="w-4 h-4 mr-2" />Stitch Round 1</>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  )}
                  {/* Round 2 */}
                  {selectedCandidate?.round_2_transcript && (
                    selectedCandidate.round_2_video_url ? (
                      <Card>
                        <CardContent className="pt-4">
                          <VideoPlayer
                            src={selectedCandidate.round_2_video_url}
                            title="Round 2 Recording"
                          />
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardContent className="pt-4 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Round 2 recording not yet assembled</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStitchRecording(2)}
                            disabled={stitchingRound !== null}
                          >
                            {stitchingRound === 2 ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Stitching…</>
                            ) : (
                              <><RotateCcw className="w-4 h-4 mr-2" />Stitch Round 2</>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Round 1 Transcript */}
            {selectedCandidate?.interview_transcript && <Separator />}
            {selectedCandidate?.interview_transcript && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-semibold">Round 1 Transcript</h3>
                </div>
                <Card>
                  <CardContent className="pt-4 max-h-[600px] overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {selectedCandidate.interview_transcript}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Round 2 Transcript */}
            {selectedCandidate?.round_2_transcript && <Separator />}
            {selectedCandidate?.round_2_transcript && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold">Round 2 Transcript</h3>
                </div>
                <Card>
                  <CardContent className="pt-4 max-h-[600px] overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {selectedCandidate.round_2_transcript}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Resume Download */}
            {selectedCandidate?.resume_url && <Separator />}
            {selectedCandidate?.resume_url && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-semibold">Resume</h3>
                </div>
                <Card className="border-emerald-500/30">
                  <CardContent className="pt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Original resume uploaded by the candidate</p>
                    <a
                      href={selectedCandidate.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </a>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Suggested for Human Interview */}
            {selectedCandidate?.rating !== null && <Separator />}
            {selectedCandidate?.rating !== null && (
              interviewNotes?.followUpQuestions?.length ||
              selectedCandidate?.round_1_full_dossier?.areasToProbe?.length ||
              selectedCandidate?.full_verdict?.technicalGaps?.length
            ) ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-lg font-semibold">Suggested for Human Interview</h3>
                </div>
                <Card className="border-cyan-500/30">
                  <CardContent className="pt-4 space-y-4">
                    {/* Dossier areas to probe */}
                    {selectedCandidate?.round_1_full_dossier?.areasToProbe && selectedCandidate.round_1_full_dossier.areasToProbe.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-yellow-400 mb-2">Areas Needing Verification</p>
                        <ul className="space-y-1">
                          {selectedCandidate.round_1_full_dossier.areasToProbe.map((area, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-yellow-400 mt-0.5">!</span>
                              {area}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Probe questions from dossier */}
                    {selectedCandidate?.round_1_full_dossier?.probeQuestions && selectedCandidate.round_1_full_dossier.probeQuestions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-cyan-400 mb-2">Probe Questions</p>
                        <ul className="space-y-2">
                          {selectedCandidate.round_1_full_dossier.probeQuestions.map((pq, i) => (
                            <li key={i} className="text-sm">
                              <div className="flex items-start gap-2">
                                <span className="text-cyan-400 mt-0.5 shrink-0">{i + 1}.</span>
                                <div>
                                  <p>{pq.question}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Re: {pq.targetClaim} ({pq.probeType.replace(/_/g, ' ')})
                                  </p>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Technical gaps from full verdict (after Round 2) */}
                    {selectedCandidate?.full_verdict?.technicalGaps && selectedCandidate.full_verdict.technicalGaps.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-red-400 mb-2">Technical Gaps to Explore</p>
                        <ul className="space-y-1">
                          {selectedCandidate.full_verdict.technicalGaps.map((gap, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-red-400 mt-0.5">-</span>
                              {gap}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {/* HR Decision */}
            {selectedCandidate?.rating !== null && <Separator />}
            {selectedCandidate?.rating !== null && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-semibold">HR Decision</h3>
                </div>

                {/* Always-visible HR notes */}
                <Card className="mb-3">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        HR Notes
                      </p>
                      {noteText !== (selectedCandidate?.hr_notes || '') && (
                        <Button size="sm" variant="ghost" onClick={() => handleSaveNote(selectedCandidate!.id)} disabled={savingNote} className="h-7 text-xs">
                          {savingNote ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Save
                        </Button>
                      )}
                    </div>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add your notes about this candidate..."
                      className="w-full bg-background border border-border rounded-lg p-3 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => handleAdvance(selectedCandidate!.id)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                    disabled={savingDecision || selectedCandidate?.final_verdict === 'Hired'}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {selectedCandidate?.final_verdict === 'Hired' ? 'Hired' : 'Advance'}
                  </Button>
                  <Button
                    onClick={() => handleReject(selectedCandidate!.id)}
                    variant="destructive"
                    className="flex-1"
                    disabled={savingDecision || selectedCandidate?.final_verdict === 'Rejected'}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {selectedCandidate?.final_verdict === 'Rejected' ? 'Rejected' : 'Reject'}
                  </Button>
                </div>
              </div>
            )}

            {/* No data state */}
            {!selectedCandidate?.interview_transcript && !selectedCandidate?.round_2_transcript && (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Interview not completed yet</p>
              </div>
            )}
          </div>

          <div className="px-6 pb-4 pt-2 border-t border-border shrink-0">
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedCandidate(null)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unified Bulk Action Modal: confirm → progress → done */}
      <Dialog
        open={!!bulkModal}
        onOpenChange={(open) => {
          // Only allow closing in done phase
          if (!open && bulkModal?.phase === 'done') setBulkModal(null);
        }}
      >
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => { if (bulkModal?.phase !== 'done') e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (bulkModal?.phase !== 'done') e.preventDefault(); }}
          // Hide the X button during confirm/progress by conditionally showing it
          hideCloseButton={bulkModal?.phase !== 'done'}
        >
          {/* Phase: Confirm */}
          {bulkModal?.phase === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle>{bulkModal.title}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-2">{bulkModal.description}</p>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setBulkModal(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={bulkModal.onConfirm}
                  className={bulkModal.variant === 'destructive' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}
                >
                  Confirm
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Phase: Progress */}
          {bulkModal?.phase === 'progress' && (
            <>
              <DialogHeader>
                <DialogTitle>{bulkModal.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <Progress value={bulkModal.total > 0 ? (bulkModal.processed / bulkModal.total) * 100 : 0} className="h-3" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {bulkModal.currentName && (
                      <span className="text-foreground">{bulkModal.currentName}</span>
                    )}
                  </span>
                  <span className="text-muted-foreground font-medium tabular-nums">
                    {bulkModal.processed} / {bulkModal.total}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing — please do not close this window
                </div>
              </div>
            </>
          )}

          {/* Phase: Done */}
          {bulkModal?.phase === 'done' && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {bulkModal.resultVariant === 'success' ? (
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                      <XCircle className="w-5 h-5 text-red-400" />
                    </div>
                  )}
                  <div>
                    <DialogTitle>{bulkModal.resultTitle}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">{bulkModal.resultDescription}</p>
                  </div>
                </div>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkModal(null)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Simple Toast Modal (for single-action feedback like failed invite) */}
      <Dialog open={!!toastModal} onOpenChange={(open) => { if (!open) setToastModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {toastModal?.variant === 'success' ? (
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
              )}
              <div>
                <DialogTitle>{toastModal?.title}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{toastModal?.description}</p>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToastModal(null)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
