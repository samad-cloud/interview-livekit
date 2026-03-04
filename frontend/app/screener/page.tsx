'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { screenResume } from '@/app/actions/bulkScreen';
import { screenCsvCandidate } from '@/app/actions/screenCsvCandidate';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  Zap,
  Filter,
  Table2,
  FileUp,
  X,
  Calendar,
  Link2,
} from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Job {
  id: string;
  title: string;
}

interface ScreeningResult {
  fileName: string;
  name?: string;
  email?: string;
  score?: number;
  reasoning?: string;
  status?: 'RECOMMENDED' | 'REJECT';
  processing: boolean;
  error?: string;
  skipped?: boolean;
}

// --- CSV Row Type ---
interface CsvRow {
  email: string;
  id: string;
  name: string;
  phone: string;
  resumeUrl: string;
  status: string;
  recordUrl: string;
  applicationDate: string;
  source: string;
  campaign: string;
}

// --- CSV Parser ---
function parseCsv(text: string): CsvRow[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header — handle possible BOM
  const header = lines[0].replace(/^\uFEFF/, '');
  const cols = parseCSVLine(header);

  // Map header names to indices
  const colMap: Record<string, number> = {};
  cols.forEach((col, i) => { colMap[col.trim()] = i; });

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 2) continue;

    rows.push({
      email: vals[colMap['Candidate Email']] || '',
      id: vals[colMap['Candidate ID']] || '',
      name: vals[colMap['Candidate Name']] || '',
      phone: vals[colMap['Candidate Phone']] || '',
      resumeUrl: vals[colMap['Candidate Resume URL']] || '',
      status: vals[colMap['Candidate Status']] || '',
      recordUrl: vals[colMap['Candidate Record URL']] || '',
      applicationDate: vals[colMap['Candidate Application Date']] || '',
      source: vals[colMap['Candidate Source']] || '',
      campaign: vals[colMap['Candidate Source Campaign']] || '',
    });
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

// --- Unique values helper ---
function uniqueValues(rows: CsvRow[], key: keyof CsvRow): string[] {
  const set = new Set<string>();
  rows.forEach(r => { if (r[key]) set.add(r[key]); });
  return Array.from(set).sort();
}

export default function ScreenerPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [results, setResults] = useState<ScreeningResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Upload mode
  const [uploadMode, setUploadMode] = useState<'pdf' | 'csv'>('csv');

  // CSV state
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');

  // CSV filters
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [filterSources, setFilterSources] = useState<Set<string>>(new Set());
  const [filterCampaigns, setFilterCampaigns] = useState<Set<string>>(new Set());
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterHasResume, setFilterHasResume] = useState(true);
  const [filterSkipDuplicates, setFilterSkipDuplicates] = useState(true);
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set());

  // Fetch jobs
  useEffect(() => {
    const fetchJobs = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title')
        .eq('is_active', true);
      if (!error && data) {
        setJobs(data);
        if (data.length > 0) setSelectedJobId(data[0].id);
      }
    };
    fetchJobs();
  }, []);

  // Fetch existing emails when CSV is loaded
  useEffect(() => {
    if (csvRows.length === 0) return;
    const fetchExisting = async () => {
      const emails = csvRows.map(r => r.email.toLowerCase()).filter(Boolean);
      if (emails.length === 0) return;
      const { data } = await supabase
        .from('candidates')
        .select('email')
        .in('email', emails);
      if (data) {
        setExistingEmails(new Set(data.map(d => d.email.toLowerCase())));
      }
    };
    fetchExisting();
  }, [csvRows]);

  // Unique filter options from CSV
  const statusOptions = useMemo(() => uniqueValues(csvRows, 'status'), [csvRows]);
  const sourceOptions = useMemo(() => uniqueValues(csvRows, 'source'), [csvRows]);
  const campaignOptions = useMemo(() => uniqueValues(csvRows, 'campaign'), [csvRows]);

  // Filtered CSV rows
  const filteredCsvRows = useMemo(() => {
    return csvRows.filter(row => {
      if (filterStatuses.size > 0 && !filterStatuses.has(row.status)) return false;
      if (filterSources.size > 0 && !filterSources.has(row.source)) return false;
      if (filterCampaigns.size > 0 && !filterCampaigns.has(row.campaign)) return false;
      if (filterHasResume && !row.resumeUrl) return false;
      if (filterSkipDuplicates && row.email && existingEmails.has(row.email.toLowerCase())) return false;
      if (filterDateFrom && row.applicationDate && row.applicationDate < filterDateFrom) return false;
      if (filterDateTo && row.applicationDate && row.applicationDate > filterDateTo) return false;
      return true;
    });
  }, [csvRows, filterStatuses, filterSources, filterCampaigns, filterHasResume, filterSkipDuplicates, filterDateFrom, filterDateTo, existingEmails]);

  // Toggle helpers for multi-select filters
  const toggleFilter = (set: Set<string>, setFn: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setFn(next);
  };

  // Handle CSV file
  const handleCsvFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      alert('No valid rows found in CSV. Check the column headers match the expected format.');
      return;
    }
    setCsvRows(rows);
    setCsvFileName(file.name);
    // Reset filters
    setFilterStatuses(new Set());
    setFilterSources(new Set());
    setFilterCampaigns(new Set());
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterHasResume(true);
    setFilterSkipDuplicates(true);
    setResults([]);
  };

  // Process CSV candidates
  const processCsvCandidates = async () => {
    if (!selectedJobId) { alert('Please select a job first'); return; }
    if (filteredCsvRows.length === 0) { alert('No candidates match your filters'); return; }

    setIsProcessing(true);
    const initial: ScreeningResult[] = filteredCsvRows.map(r => ({
      fileName: r.name || r.email,
      name: r.name,
      email: r.email,
      processing: true,
    }));
    setResults(initial);

    for (let i = 0; i < filteredCsvRows.length; i++) {
      const row = filteredCsvRows[i];
      try {
        const result = await screenCsvCandidate(selectedJobId, {
          name: row.name,
          email: row.email,
          resumeUrl: row.resumeUrl,
          phone: row.phone,
          source: row.source,
          campaign: row.campaign,
          applicationDate: row.applicationDate,
        });
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, processing: false, score: result.score, reasoning: result.reasoning, status: result.status, error: result.error, skipped: result.skipped } : r
        ));
      } catch {
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, processing: false, error: 'Failed to process' } : r
        ));
      }
    }
    setIsProcessing(false);
  };

  // Handle PDF file processing (existing)
  const processFiles = useCallback(async (files: FileList) => {
    if (!selectedJobId) { alert('Please select a job first'); return; }
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) { alert('No PDF files found.'); return; }

    setIsProcessing(true);
    const initialResults: ScreeningResult[] = pdfFiles.map(f => ({ fileName: f.name, processing: true }));
    setResults(initialResults);

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      const formData = new FormData();
      formData.append('file', file);
      try {
        const result = await screenResume(selectedJobId, formData);
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, processing: false, name: result.name, email: result.email, score: result.score, reasoning: result.reasoning, status: result.status, error: result.error, skipped: result.skipped } : r
        ));
      } catch {
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, processing: false, error: 'Failed to process' } : r
        ));
      }
    }
    setIsProcessing(false);
  }, [selectedJobId]);

  // Drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (uploadMode === 'csv' && files[0].name.endsWith('.csv')) {
      handleCsvFile(files[0]);
    } else if (uploadMode === 'pdf') {
      processFiles(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadMode === 'csv' && files[0].name.endsWith('.csv')) {
      handleCsvFile(files[0]);
    } else if (uploadMode === 'pdf') {
      processFiles(files);
    }
    e.target.value = '';
  };

  // Stats
  const sortedResults = [...results].sort((a, b) => (b.score || 0) - (a.score || 0));
  const processed = results.filter(r => !r.processing);
  const recommended = processed.filter(r => r.status === 'RECOMMENDED');
  const rejected = processed.filter(r => r.status === 'REJECT');

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 hover:bg-muted rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Zap className="w-6 h-6 text-yellow-500" />
                  The War Room
                </h1>
                <p className="text-muted-foreground text-sm">Bulk AI Resume Screening</p>
              </div>
            </div>
            {processed.length > 0 && (
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{processed.length}</p>
                  <p className="text-muted-foreground">Processed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-400">{recommended.length}</p>
                  <p className="text-muted-foreground">Recommended</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">{rejected.length}</p>
                  <p className="text-muted-foreground">Rejected</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Step 1: Job + Mode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Step 1: Select Job Position</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              {jobs.length === 0 && <option value="">No active jobs found</option>}
              {jobs.map(job => (
                <option key={job.id} value={job.id}>{job.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Upload Mode</label>
            <div className="flex gap-2">
              <Button
                variant={uploadMode === 'csv' ? 'default' : 'outline'}
                onClick={() => { setUploadMode('csv'); setResults([]); }}
                className={uploadMode === 'csv' ? 'bg-yellow-600 hover:bg-yellow-500' : 'border-border text-muted-foreground hover:bg-muted'}
              >
                <Table2 className="w-4 h-4 mr-2" />
                CSV (BetterTeam)
              </Button>
              <Button
                variant={uploadMode === 'pdf' ? 'default' : 'outline'}
                onClick={() => { setUploadMode('pdf'); setCsvRows([]); setCsvFileName(''); setResults([]); }}
                className={uploadMode === 'pdf' ? 'bg-yellow-600 hover:bg-yellow-500' : 'border-border text-muted-foreground hover:bg-muted'}
              >
                <FileUp className="w-4 h-4 mr-2" />
                PDF Resumes
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2: Upload Zone */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Step 2: {uploadMode === 'csv' ? 'Upload BetterTeam CSV' : 'Upload Resumes'}
          </label>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              dragActive ? 'border-yellow-500 bg-yellow-500/10' : 'border-border hover:border-muted-foreground/40 bg-card/50'
            }`}
          >
            <input
              type="file"
              multiple={uploadMode === 'pdf'}
              accept={uploadMode === 'csv' ? '.csv' : '.pdf'}
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />
            <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-yellow-500' : 'text-muted-foreground'}`} />
            <p className="text-lg font-medium text-muted-foreground">
              {isProcessing ? 'Processing...' : uploadMode === 'csv' ? 'Drop BetterTeam CSV here or click to upload' : 'Drop PDF resumes here or click to upload'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {uploadMode === 'csv' ? 'Single .csv file from BetterTeam export' : 'Supports multiple files • PDF only'}
            </p>
          </div>
        </div>

        {/* Step 3: CSV Filters (only in CSV mode after upload) */}
        {uploadMode === 'csv' && csvRows.length > 0 && !isProcessing && results.length === 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold text-muted-foreground">
                  Step 3: Filter Candidates
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  {csvFileName}
                </Badge>
                <Badge className="bg-yellow-500/20 text-yellow-400">
                  {filteredCsvRows.length} of {csvRows.length} match
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setCsvRows([]); setCsvFileName(''); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Status Filter */}
              {statusOptions.length > 0 && (
                <Card className="bg-card border-border">
                  <CardContent className="pt-4">
                    <Label className="text-muted-foreground text-sm mb-2 block">Status</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {statusOptions.map(s => (
                        <button
                          key={s}
                          onClick={() => toggleFilter(filterStatuses, setFilterStatuses, s)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            filterStatuses.size === 0 || filterStatuses.has(s)
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {s} ({csvRows.filter(r => r.status === s).length})
                        </button>
                      ))}
                    </div>
                    {filterStatuses.size > 0 && (
                      <button onClick={() => setFilterStatuses(new Set())} className="text-xs text-muted-foreground mt-2 hover:text-muted-foreground">
                        Clear filter
                      </button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Source Filter */}
              {sourceOptions.length > 0 && (
                <Card className="bg-card border-border">
                  <CardContent className="pt-4">
                    <Label className="text-muted-foreground text-sm mb-2 block">Source</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {sourceOptions.map(s => (
                        <button
                          key={s}
                          onClick={() => toggleFilter(filterSources, setFilterSources, s)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            filterSources.size === 0 || filterSources.has(s)
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {s} ({csvRows.filter(r => r.source === s).length})
                        </button>
                      ))}
                    </div>
                    {filterSources.size > 0 && (
                      <button onClick={() => setFilterSources(new Set())} className="text-xs text-muted-foreground mt-2 hover:text-muted-foreground">
                        Clear filter
                      </button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Campaign Filter */}
              {campaignOptions.length > 0 && (
                <Card className="bg-card border-border">
                  <CardContent className="pt-4">
                    <Label className="text-muted-foreground text-sm mb-2 block">Campaign</Label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {campaignOptions.map(c => (
                        <button
                          key={c}
                          onClick={() => toggleFilter(filterCampaigns, setFilterCampaigns, c)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            filterCampaigns.size === 0 || filterCampaigns.has(c)
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {c} ({csvRows.filter(r => r.campaign === c).length})
                        </button>
                      ))}
                    </div>
                    {filterCampaigns.size > 0 && (
                      <button onClick={() => setFilterCampaigns(new Set())} className="text-xs text-muted-foreground mt-2 hover:text-muted-foreground">
                        Clear filter
                      </button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Date Range */}
              <Card className="bg-card border-border">
                <CardContent className="pt-4">
                  <Label className="text-muted-foreground text-sm mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Application Date Range
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="bg-muted border-border text-foreground text-sm"
                    />
                    <span className="text-muted-foreground self-center">to</span>
                    <Input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="bg-muted border-border text-foreground text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Toggles */}
              <Card className="bg-card border-border">
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground text-sm flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" />
                      Has Resume URL
                    </Label>
                    <Switch checked={filterHasResume} onCheckedChange={setFilterHasResume} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground text-sm flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      Skip Duplicates
                    </Label>
                    <Switch checked={filterSkipDuplicates} onCheckedChange={setFilterSkipDuplicates} />
                  </div>
                  {filterSkipDuplicates && existingEmails.size > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {existingEmails.size} email{existingEmails.size !== 1 ? 's' : ''} already in system
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Preview Table */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Preview — {filteredCsvRows.length} candidate{filteredCsvRows.length !== 1 ? 's' : ''} to screen
                </h3>
                <Button
                  onClick={processCsvCandidates}
                  disabled={isProcessing || filteredCsvRows.length === 0 || !selectedJobId}
                  className="bg-yellow-600 hover:bg-yellow-500"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Screen {filteredCsvRows.length} Candidate{filteredCsvRows.length !== 1 ? 's' : ''}
                </Button>
              </div>

              {filteredCsvRows.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="text-left text-muted-foreground font-medium px-4 py-2 text-xs">#</th>
                        <th className="text-left text-muted-foreground font-medium px-4 py-2 text-xs">Name</th>
                        <th className="text-left text-muted-foreground font-medium px-4 py-2 text-xs">Email</th>
                        <th className="text-left text-muted-foreground font-medium px-4 py-2 text-xs">Source</th>
                        <th className="text-left text-muted-foreground font-medium px-4 py-2 text-xs">Date</th>
                        <th className="text-left text-muted-foreground font-medium px-4 py-2 text-xs">Resume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCsvRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="border-t border-border/50 hover:bg-muted/30">
                          <td className="px-4 py-2 text-xs text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2 text-sm text-foreground">{row.name || '—'}</td>
                          <td className="px-4 py-2 text-sm text-muted-foreground">{row.email || '—'}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{row.source || '—'}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{row.applicationDate || '—'}</td>
                          <td className="px-4 py-2">
                            {row.resumeUrl ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-400" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredCsvRows.length > 50 && (
                    <div className="text-center py-2 text-xs text-muted-foreground border-t border-border">
                      Showing first 50 of {filteredCsvRows.length} candidates
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results Leaderboard */}
        {results.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-muted-foreground mb-4">
              {csvRows.length > 0 ? 'Step 4' : 'Step 3'}: Live Leaderboard
            </h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left text-muted-foreground font-medium px-4 py-3">Name</th>
                    <th className="text-left text-muted-foreground font-medium px-4 py-3">Email</th>
                    <th className="text-left text-muted-foreground font-medium px-4 py-3">Score</th>
                    <th className="text-left text-muted-foreground font-medium px-4 py-3">Status</th>
                    <th className="text-left text-muted-foreground font-medium px-4 py-3">Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((result, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        {result.processing ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                            <span className="text-muted-foreground">{result.name || '...'}</span>
                          </div>
                        ) : (
                          <span className="text-foreground">{result.name || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground text-sm">{result.email || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {result.processing ? (
                          <span className="text-muted-foreground">...</span>
                        ) : result.score !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${result.score >= 70 ? 'bg-emerald-500' : result.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${result.score}%` }}
                              />
                            </div>
                            <span className={`font-semibold ${result.score >= 70 ? 'text-emerald-400' : result.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {result.score}
                            </span>
                          </div>
                        ) : (
                          <span className="text-red-400">Error</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {result.processing ? (
                          <span className="text-muted-foreground">Processing...</span>
                        ) : result.skipped ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground rounded-full text-xs">Duplicate</span>
                        ) : result.status === 'RECOMMENDED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs">
                            <CheckCircle className="w-3 h-3" /> Interview
                          </span>
                        ) : result.status === 'REJECT' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        ) : (
                          <span className="text-red-400 text-xs">{result.error || 'Error'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground text-sm">{result.reasoning || result.error || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
