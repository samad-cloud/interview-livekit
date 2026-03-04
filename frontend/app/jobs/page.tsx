'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Briefcase,
  MapPin,
  Clock,
  Users,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// --- Types ---
interface Job {
  id: number;
  title: string;
  description: string | null;
  is_active: boolean;
  location: string | null;
  work_arrangement: string | null;
  department: string | null;
  urgency: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  visa_sponsorship: boolean;
  education_required: string | null;
  experience_min: number | null;
  experience_max: number | null;
  skills_must_have: string[] | null;
  skills_nice_to_have: string[] | null;
  ideal_candidate: string | null;
  red_flags: string | null;
  project_context: string | null;
  created_at: string | null;
  updated_at: string | null;
  candidate_count?: number;
}

// --- Skill Input Component ---
function SkillInput({
  skills,
  setSkills,
  placeholder,
}: {
  skills: string[];
  setSkills: (skills: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const addSkill = () => {
    const trimmed = input.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setInput('');
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant="secondary" size="icon" onClick={addSkill}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map(skill => (
            <Badge
              key={skill}
              variant="secondary"
              className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
            >
              {skill}
              <button type="button" onClick={() => setSkills(skills.filter(s => s !== skill))} className="ml-1 hover:text-emerald-200">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit dialog state
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWorkArrangement, setEditWorkArrangement] = useState('');
  const [editUrgency, setEditUrgency] = useState('');
  const [editSalaryMin, setEditSalaryMin] = useState('');
  const [editSalaryMax, setEditSalaryMax] = useState('');
  const [editSalaryCurrency, setEditSalaryCurrency] = useState('');
  const [editSalaryPeriod, setEditSalaryPeriod] = useState('');
  const [editVisaSponsorship, setEditVisaSponsorship] = useState(false);
  const [editEducation, setEditEducation] = useState('');
  const [editExpMin, setEditExpMin] = useState('');
  const [editExpMax, setEditExpMax] = useState('');
  const [editSkillsMustHave, setEditSkillsMustHave] = useState<string[]>([]);
  const [editSkillsNiceToHave, setEditSkillsNiceToHave] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState('');
  const [editProjectContext, setEditProjectContext] = useState('');
  const [editIdealCandidate, setEditIdealCandidate] = useState('');
  const [editRedFlags, setEditRedFlags] = useState('');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      // Fetch candidate counts per job
      const { data: countData } = await supabase
        .from('candidates')
        .select('job_id');

      const countMap: Record<number, number> = {};
      if (countData) {
        for (const c of countData) {
          if (c.job_id) {
            countMap[c.job_id] = (countMap[c.job_id] || 0) + 1;
          }
        }
      }

      const enriched = (jobsData || []).map(j => ({
        ...j,
        candidate_count: countMap[j.id] || 0,
      }));

      setJobs(enriched);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      setMessage({ type: 'error', text: 'Failed to load jobs.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Clear messages after 4s
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const toggleActive = async (job: Job) => {
    const newStatus = !job.is_active;
    const { error } = await supabase
      .from('jobs')
      .update({ is_active: newStatus })
      .eq('id', job.id);

    if (error) {
      setMessage({ type: 'error', text: `Failed to update "${job.title}".` });
      return;
    }

    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_active: newStatus } : j));
    setMessage({ type: 'success', text: `"${job.title}" is now ${newStatus ? 'active' : 'inactive'}.` });
  };

  const openEdit = (job: Job) => {
    setEditingJob(job);
    setEditTitle(job.title || '');
    setEditDepartment(job.department || '');
    setEditLocation(job.location || 'Dubai');
    setEditWorkArrangement(job.work_arrangement || 'onsite');
    setEditUrgency(job.urgency || '30_days');
    setEditSalaryMin(job.salary_min?.toString() || '');
    setEditSalaryMax(job.salary_max?.toString() || '');
    setEditSalaryCurrency(job.salary_currency || 'AED');
    setEditSalaryPeriod(job.salary_period || 'monthly');
    setEditVisaSponsorship(job.visa_sponsorship ?? false);
    setEditEducation(job.education_required || 'bachelors');
    setEditExpMin(job.experience_min?.toString() || '0');
    setEditExpMax(job.experience_max?.toString() || '');
    setEditSkillsMustHave(job.skills_must_have || []);
    setEditSkillsNiceToHave(job.skills_nice_to_have || []);
    setEditDescription(job.description || '');
    setEditProjectContext(job.project_context || '');
    setEditIdealCandidate(job.ideal_candidate || '');
    setEditRedFlags(job.red_flags || '');
  };

  const handleSave = async () => {
    if (!editingJob) return;
    if (!editTitle.trim()) {
      setMessage({ type: 'error', text: 'Job title is required.' });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          title: editTitle.trim(),
          department: editDepartment || null,
          location: editLocation,
          work_arrangement: editWorkArrangement,
          urgency: editUrgency,
          salary_min: editSalaryMin ? parseInt(editSalaryMin) : null,
          salary_max: editSalaryMax ? parseInt(editSalaryMax) : null,
          salary_currency: editSalaryCurrency,
          salary_period: editSalaryPeriod,
          visa_sponsorship: editVisaSponsorship,
          education_required: editEducation,
          experience_min: parseInt(editExpMin) || 0,
          experience_max: editExpMax ? parseInt(editExpMax) : null,
          skills_must_have: editSkillsMustHave.length > 0 ? editSkillsMustHave : null,
          skills_nice_to_have: editSkillsNiceToHave.length > 0 ? editSkillsNiceToHave : null,
          description: editDescription || null,
          project_context: editProjectContext || null,
          ideal_candidate: editIdealCandidate || null,
          red_flags: editRedFlags || null,
        })
        .eq('id', editingJob.id);

      if (error) throw error;

      setMessage({ type: 'success', text: `"${editTitle}" updated successfully.` });
      setEditingJob(null);
      fetchJobs();
    } catch (err) {
      console.error('Save failed:', err);
      setMessage({ type: 'error', text: 'Failed to save changes.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered jobs
  const filtered = jobs.filter(job => {
    const matchesSearch = !searchQuery
      || job.title.toLowerCase().includes(searchQuery.toLowerCase())
      || (job.department || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterActive === 'all'
      || (filterActive === 'active' && job.is_active)
      || (filterActive === 'inactive' && !job.is_active);
    return matchesSearch && matchesFilter;
  });

  const formatSalary = (job: Job) => {
    if (!job.salary_min && !job.salary_max) return null;
    const curr = job.salary_currency || 'AED';
    const period = job.salary_period === 'yearly' ? '/yr' : '/mo';
    if (job.salary_min && job.salary_max) return `${curr} ${job.salary_min.toLocaleString()}-${job.salary_max.toLocaleString()}${period}`;
    if (job.salary_min) return `${curr} ${job.salary_min.toLocaleString()}+${period}`;
    return `Up to ${curr} ${job.salary_max!.toLocaleString()}${period}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const urgencyLabel: Record<string, string> = {
    asap: 'ASAP',
    '30_days': '30 days',
    '60_days': '60 days',
    '90_days': '90 days',
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <Image src="/logo.jpg" alt="Printerpix" width={48} height={48} className="rounded-xl" />
            <div>
              <h1 className="text-3xl font-bold">Manage Jobs</h1>
              <p className="text-muted-foreground">
                {jobs.length} job{jobs.length !== 1 ? 's' : ''} total
                {' '}&middot;{' '}
                {jobs.filter(j => j.is_active).length} active
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/gen-job">
              <Plus className="w-4 h-4 mr-2" />
              Create Job
            </Link>
          </Button>
        </div>

        {/* Message Toast */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
              : 'bg-destructive/20 border border-destructive/30 text-destructive'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterActive} onValueChange={(v) => setFilterActive(v as 'all' | 'active' | 'inactive')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Job Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Briefcase className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || filterActive !== 'all' ? 'No jobs match your filters.' : 'No jobs yet. Create your first job posting.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map(job => (
              <Card key={job.id} className={!job.is_active ? 'opacity-60' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Job info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold truncate">{job.title}</h3>
                        <Badge variant={job.is_active ? 'default' : 'secondary'} className={job.is_active ? 'bg-emerald-500/20 text-emerald-400' : ''}>
                          {job.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {job.location}{job.work_arrangement && job.work_arrangement !== 'onsite' ? ` (${job.work_arrangement})` : ''}
                          </span>
                        )}
                        {job.department && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5" />
                            {job.department}
                          </span>
                        )}
                        {job.urgency && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {urgencyLabel[job.urgency] || job.urgency}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {job.candidate_count} candidate{job.candidate_count !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {formatSalary(job) && (
                          <Badge variant="outline">{formatSalary(job)}</Badge>
                        )}
                        {job.visa_sponsorship && (
                          <Badge variant="outline" className="border-blue-500/30 text-blue-400">Visa Sponsorship</Badge>
                        )}
                        {job.education_required && job.education_required !== 'none' && (
                          <Badge variant="outline">{job.education_required}</Badge>
                        )}
                        {job.experience_min != null && (
                          <Badge variant="outline">
                            {job.experience_min}{job.experience_max ? `-${job.experience_max}` : '+'} yrs
                          </Badge>
                        )}
                        <span className="text-muted-foreground ml-auto text-xs">
                          Created {formatDate(job.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{job.is_active ? 'Active' : 'Off'}</span>
                        <Switch
                          checked={job.is_active}
                          onCheckedChange={() => toggleActive(job)}
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openEdit(job)}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Edit
                      </Button>
                    </div>
                  </div>

                  {/* Skills row */}
                  {((job.skills_must_have && job.skills_must_have.length > 0) || (job.skills_nice_to_have && job.skills_nice_to_have.length > 0)) && (
                    <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
                      {job.skills_must_have?.map(s => (
                        <Badge key={s} variant="secondary" className="bg-emerald-500/15 text-emerald-400 text-xs">{s}</Badge>
                      ))}
                      {job.skills_nice_to_have?.map(s => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingJob} onOpenChange={(open) => { if (!open) setEditingJob(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job — {editingJob?.title}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="compensation">Compensation</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="description">Description</TabsTrigger>
            </TabsList>

            {/* Tab: Details */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Job Title <span className="text-destructive">*</span></Label>
                <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select value={editLocation} onValueChange={setEditLocation}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dubai">Dubai</SelectItem>
                      <SelectItem value="London">London</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work Arrangement</Label>
                  <Select value={editWorkArrangement} onValueChange={setEditWorkArrangement}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onsite">On-site</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <Select value={editUrgency} onValueChange={setEditUrgency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asap">ASAP</SelectItem>
                      <SelectItem value="30_days">Within 30 days</SelectItem>
                      <SelectItem value="60_days">Within 60 days</SelectItem>
                      <SelectItem value="90_days">Within 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Compensation */}
            <TabsContent value="compensation" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={editSalaryCurrency} onValueChange={setEditSalaryCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select value={editSalaryPeriod} onValueChange={setEditSalaryPeriod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Salary</Label>
                  <Input type="number" value={editSalaryMin} onChange={(e) => setEditSalaryMin(e.target.value)} placeholder="5000" />
                </div>
                <div className="space-y-2">
                  <Label>Maximum Salary</Label>
                  <Input type="number" value={editSalaryMax} onChange={(e) => setEditSalaryMax(e.target.value)} placeholder="10000" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Switch checked={editVisaSponsorship} onCheckedChange={setEditVisaSponsorship} />
                <Label>Visa Sponsorship Available</Label>
              </div>
            </TabsContent>

            {/* Tab: Requirements */}
            <TabsContent value="requirements" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Education</Label>
                  <Select value={editEducation} onValueChange={setEditEducation}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="bachelors">Bachelor&apos;s</SelectItem>
                      <SelectItem value="masters">Master&apos;s</SelectItem>
                      <SelectItem value="phd">PhD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Min Experience (yrs)</Label>
                  <Input type="number" value={editExpMin} onChange={(e) => setEditExpMin(e.target.value)} min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Max Experience (yrs)</Label>
                  <Input type="number" value={editExpMax} onChange={(e) => setEditExpMax(e.target.value)} min="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Must-Have Skills</Label>
                <SkillInput skills={editSkillsMustHave} setSkills={setEditSkillsMustHave} placeholder="Add a must-have skill..." />
              </div>
              <div className="space-y-2">
                <Label>Nice-to-Have Skills</Label>
                <SkillInput skills={editSkillsNiceToHave} setSkills={setEditSkillsNiceToHave} placeholder="Add a nice-to-have skill..." />
              </div>
            </TabsContent>

            {/* Tab: Description */}
            <TabsContent value="description" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Job Description</Label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={10} className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Project Context</Label>
                <Textarea value={editProjectContext} onChange={(e) => setEditProjectContext(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Ideal Candidate</Label>
                <Textarea value={editIdealCandidate} onChange={(e) => setEditIdealCandidate(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Red Flags</Label>
                <Textarea value={editRedFlags} onChange={(e) => setEditRedFlags(e.target.value)} rows={2} />
              </div>
            </TabsContent>
          </Tabs>

          {/* Save / Cancel */}
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setEditingJob(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
