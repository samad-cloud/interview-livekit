'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { generateJobDescription, refineJobDescription, type JobCitation } from '../actions/generateJob';
import { generateSkills } from '../actions/generateSkills';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  DollarSign,
  GraduationCap,
  Sparkles,
  Target,
  AlertTriangle,
  FileText,
  Loader2,
  CheckCircle,
  Plus,
  X,
  ExternalLink,
  Globe,
  Wand2,
} from 'lucide-react';

// shadcn components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Company {
  id: string;
  name: string;
  about: string;
  industry: string | null;
  website: string | null;
  headquarters: string | null;
  size: string | null;
  culture: string | null;
}

interface LocationRow {
  id: string;
  country: string;
  city: string | null;
  currency_code: string;
  currency_name: string;
}

// Skill tag input component
function SkillInput({
  skills,
  setSkills,
  placeholder,
  disabled = false,
}: {
  skills: string[],
  setSkills: (skills: string[]) => void,
  placeholder: string,
  disabled?: boolean,
}) {
  const [input, setInput] = useState('');

  const addSkill = () => {
    const trimmed = input.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1"
        />
        <Button type="button" variant="secondary" size="icon" onClick={addSkill} disabled={disabled}>
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
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                className="ml-1 hover:text-emerald-200"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GenJobPage() {
  // Company
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyAbout, setNewCompanyAbout] = useState('');
  const [newCompanyIndustry, setNewCompanyIndustry] = useState('');
  const [newCompanyWebsite, setNewCompanyWebsite] = useState('');
  const [newCompanyHeadquarters, setNewCompanyHeadquarters] = useState('');
  const [newCompanySize, setNewCompanySize] = useState('');
  const [newCompanyCulture, setNewCompanyCulture] = useState('');
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  // Locations from DB
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  // Derived: unique currencies from locations
  const currencies = Array.from(
    new Map(locations.map(l => [l.currency_code, l.currency_name])).entries()
  ).map(([code, name]) => ({ code, label: `${code} - ${name}` }));

  // Derived: location options for the select (city, country, or "Country (no city)")
  const locationOptions = locations.map(l => ({
    id: l.id,
    label: l.city ? `${l.city}, ${l.country}` : l.country,
    currency: l.currency_code,
  }));

  // Add location/currency dialog state
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newCountry, setNewCountry] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [addCurrencyCode, setAddCurrencyCode] = useState('');
  const [addCurrencyName, setAddCurrencyName] = useState('');

  // Step 1: Core Details
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('Dubai');
  const [workArrangement, setWorkArrangement] = useState('onsite');
  const [urgency, setUrgency] = useState('30_days');

  // Step 2: Compensation
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('AED');
  const [salaryPeriod, setSalaryPeriod] = useState('monthly');
  const [visaSponsorship, setVisaSponsorship] = useState(true);

  // Step 3: Requirements
  const [educationRequired, setEducationRequired] = useState('bachelors');
  const [experienceMin, setExperienceMin] = useState('0');
  const [experienceMax, setExperienceMax] = useState('2');
  const [skillsMustHave, setSkillsMustHave] = useState<string[]>([]);
  const [skillsNiceToHave, setSkillsNiceToHave] = useState<string[]>([]);

  // Step 4: AI Context
  const [projectContext, setProjectContext] = useState('');
  const [idealCandidate, setIdealCandidate] = useState('');
  const [redFlags, setRedFlags] = useState('');

  // Step 5: Generated Description
  const [description, setDescription] = useState('');
  const [citations, setCitations] = useState<JobCitation[]>([]);

  // UI State
  const [isGeneratingSkills, setIsGeneratingSkills] = useState(false);
  const skillsGeneratedForTitle = useRef<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeStep, setActiveStep] = useState(1);

  // Fetch companies and locations on mount
  useEffect(() => {
    supabase.from('companies').select('*').order('name').then(({ data }) => {
      if (data) setCompanies(data as Company[]);
    });
    supabase.from('locations').select('*').order('country').order('city').then(({ data }) => {
      if (data) {
        setLocations(data as LocationRow[]);
        // Default to first location's label if nothing selected
        if (!location && data.length > 0) {
          const first = data[0] as LocationRow;
          setLocation(first.city ? `${first.city}, ${first.country}` : first.country);
          setSalaryCurrency(first.currency_code);
        }
      }
    });
  }, []);

  // Auto-generate skills when entering Step 3
  useEffect(() => {
    if (activeStep !== 3 || !title || skillsGeneratedForTitle.current === title) return;

    let cancelled = false;
    setIsGeneratingSkills(true);
    setMessage(null);

    generateSkills(title)
      .then((result) => {
        if (cancelled) return;
        skillsGeneratedForTitle.current = title;
        setSkillsMustHave(prev => {
          const merged = new Set([...prev, ...result.mustHave]);
          return Array.from(merged);
        });
        setSkillsNiceToHave(prev => {
          const merged = new Set([...prev, ...result.niceToHave]);
          return Array.from(merged);
        });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Skill generation failed:', error);
        setMessage({ type: 'error', text: 'Failed to auto-generate skills. You can add them manually.' });
      })
      .finally(() => {
        if (!cancelled) setIsGeneratingSkills(false);
      });

    return () => { cancelled = true; };
  }, [activeStep, title]);

  const handleLocationChange = (val: string) => {
    setLocation(val);
    const match = locationOptions.find(l => l.label === val);
    if (match) setSalaryCurrency(match.currency);
  };

  const handleAddLocation = async () => {
    const country = newCountry.trim();
    const city = newCity.trim() || null;
    const code = newCurrencyCode.trim().toUpperCase();
    const name = newCurrencyName.trim();
    if (!country || !code || !name) return;

    setIsSavingLocation(true);
    try {
      const { data, error } = await supabase.from('locations').insert({
        country,
        city,
        currency_code: code,
        currency_name: name,
      }).select().single();

      if (error) throw error;

      const row = data as LocationRow;
      setLocations(prev => [...prev, row]);
      const label = row.city ? `${row.city}, ${row.country}` : row.country;
      setLocation(label);
      setSalaryCurrency(row.currency_code);

      setNewCountry('');
      setNewCity('');
      setNewCurrencyCode('');
      setNewCurrencyName('');
      setShowAddLocation(false);
    } catch (err) {
      console.error('Failed to save location:', err);
      setMessage({ type: 'error', text: 'Failed to save location. It may already exist.' });
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleAddCurrency = async () => {
    const code = addCurrencyCode.trim().toUpperCase();
    const name = addCurrencyName.trim();
    if (!code || !name) return;
    if (currencies.some(c => c.code === code)) return;

    // Add a country-less location row for this currency
    setIsSavingLocation(true);
    try {
      const { data, error } = await supabase.from('locations').insert({
        country: name,
        city: null,
        currency_code: code,
        currency_name: name,
      }).select().single();

      if (error) throw error;

      setLocations(prev => [...prev, data as LocationRow]);
      setSalaryCurrency(code);
      setAddCurrencyCode('');
      setAddCurrencyName('');
      setShowAddCurrency(false);
    } catch (err) {
      console.error('Failed to save currency:', err);
      setMessage({ type: 'error', text: 'Failed to save currency. It may already exist.' });
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleGenerate = async () => {
    if (!title || !location) {
      setMessage({ type: 'error', text: 'Please fill in Job Title and Location' });
      return;
    }

    setIsGenerating(true);
    setMessage(null);

    try {
      const salaryText = salaryMin && salaryMax
        ? `${salaryCurrency} ${salaryMin} - ${salaryMax} ${salaryPeriod}`
        : '';

      const selectedCompany = companies.find(c => c.id === selectedCompanyId);

      const result = await generateJobDescription({
        title,
        salary: salaryText,
        location,
        companyName: selectedCompany?.name,
        companyContext: selectedCompany
          ? [
              `Company: ${selectedCompany.name}`,
              `About: ${selectedCompany.about}`,
              selectedCompany.industry && `Industry: ${selectedCompany.industry}`,
              selectedCompany.website && `Website: ${selectedCompany.website}`,
              selectedCompany.headquarters && `Headquarters: ${selectedCompany.headquarters}`,
              selectedCompany.size && `Company Size: ${selectedCompany.size}`,
              selectedCompany.culture && `Culture & Values: ${selectedCompany.culture}`,
            ].filter(Boolean).join('\n')
          : undefined,
        experienceLevel: `${experienceMin}-${experienceMax} years`,
        keySkills: skillsMustHave.join(', '),
        employmentType: 'Full-time',
        mustHave: skillsMustHave.join(', '),
        niceToHave: skillsNiceToHave.join(', '),
        companyPerks: visaSponsorship ? 'Visa sponsorship available' : '',
      });
      setDescription(result.description);
      setCitations(result.citations);
      setActiveStep(5);
    } catch (error) {
      console.error('Generation failed:', error);
      setMessage({ type: 'error', text: 'Failed to generate description. Try again.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!refinePrompt.trim() || !description) return;
    setIsRefining(true);
    try {
      const updated = await refineJobDescription(description, refinePrompt.trim());
      setDescription(updated);
      setRefinePrompt('');
    } catch (error) {
      console.error('Refinement failed:', error);
      setMessage({ type: 'error', text: 'Failed to refine. Please try again.' });
    } finally {
      setIsRefining(false);
    }
  };

  const handlePublish = async () => {
    if (!title || !description) {
      setMessage({ type: 'error', text: 'Title and description are required' });
      return;
    }

    setIsPublishing(true);
    setMessage(null);

    try {
      const { error } = await supabase.from('jobs').insert({
        title,
        description,
        is_active: true,
        company_id: selectedCompanyId || null,
        location,
        work_arrangement: workArrangement,
        department: department || null,
        urgency,
        salary_min: salaryMin ? parseInt(salaryMin) : null,
        salary_max: salaryMax ? parseInt(salaryMax) : null,
        salary_currency: salaryCurrency,
        salary_period: salaryPeriod,
        visa_sponsorship: visaSponsorship,
        education_required: educationRequired,
        experience_min: parseInt(experienceMin) || 0,
        experience_max: experienceMax ? parseInt(experienceMax) : null,
        skills_must_have: skillsMustHave.length > 0 ? skillsMustHave : null,
        skills_nice_to_have: skillsNiceToHave.length > 0 ? skillsNiceToHave : null,
        ideal_candidate: idealCandidate || null,
        red_flags: redFlags || null,
        project_context: projectContext || null,
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Job posted successfully! Redirecting...' });

      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);

    } catch (error) {
      console.error('Publish failed:', error);
      setMessage({ type: 'error', text: 'Failed to publish job. Try again.' });
    } finally {
      setIsPublishing(false);
    }
  };

  const steps = [
    { num: 1, label: 'Core Details', icon: Briefcase },
    { num: 2, label: 'Compensation', icon: DollarSign },
    { num: 3, label: 'Requirements', icon: GraduationCap },
    { num: 4, label: 'AI Context', icon: Target },
    { num: 5, label: 'Review', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <Image
              src="/logo.jpg"
              alt="Printerpix"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <div>
              <h1 className="text-2xl font-bold">Create Job</h1>
              <p className="text-muted-foreground text-sm">Configure the Job Input Document for AI recruiting</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="border-b bg-muted/30">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step) => (
              <Button
                key={step.num}
                variant={activeStep === step.num ? 'secondary' : 'ghost'}
                onClick={() => setActiveStep(step.num)}
                className={activeStep === step.num ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : ''}
              >
                <step.icon className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.num}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Message Toast */}
      {message && (
        <div className="max-w-5xl mx-auto px-6 mt-6">
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
              : 'bg-destructive/20 border border-destructive/30 text-destructive'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {message.text}
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Step 1: Core Details */}
        {activeStep === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle>Core Details</CardTitle>
                  <CardDescription>Basic job information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company Selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Company
                </Label>
                <div className="flex gap-2">
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a company..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddCompany(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Company
                  </Button>
                </div>
                {selectedCompanyId && (
                  <p className="text-sm text-muted-foreground italic">
                    {companies.find(c => c.id === selectedCompanyId)?.about}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="title">
                    Job Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., AI Engineer (Entry Level)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g., Growth & AI Team"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Location <span className="text-destructive">*</span></Label>
                  <div className="flex gap-2">
                    <Select value={location} onValueChange={handleLocationChange}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select location..." />
                      </SelectTrigger>
                      <SelectContent>
                        {locationOptions.map(loc => (
                          <SelectItem key={loc.id} value={loc.label}>{loc.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowAddLocation(true)}
                      title="Add new location"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Work Arrangement</Label>
                  <Select value={workArrangement} onValueChange={setWorkArrangement}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onsite">On-site</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Hiring Urgency</Label>
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asap">ASAP</SelectItem>
                      <SelectItem value="30_days">Within 30 days</SelectItem>
                      <SelectItem value="60_days">Within 60 days</SelectItem>
                      <SelectItem value="90_days">Within 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={() => setActiveStep(2)}>
                  Next: Compensation →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Compensation */}
        {activeStep === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle>Compensation & Benefits</CardTitle>
                  <CardDescription>Salary range and visa sponsorship</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <div className="flex gap-2">
                    <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select currency..." />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(cur => (
                          <SelectItem key={cur.code} value={cur.code}>{cur.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowAddCurrency(true)}
                      title="Add new currency"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salaryMin">Minimum</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder="5000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salaryMax">Maximum</Label>
                  <Input
                    id="salaryMax"
                    type="number"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder="10000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select value={salaryPeriod} onValueChange={setSalaryPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visaSponsorship}
                      onChange={(e) => setVisaSponsorship(e.target.checked)}
                      className="w-5 h-5 rounded border-input bg-background text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-medium">Visa Sponsorship Available</span>
                      <p className="text-muted-foreground text-sm">Check if company can sponsor work visas for this role</p>
                    </div>
                  </label>
                </CardContent>
              </Card>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setActiveStep(1)}>
                  ← Back
                </Button>
                <Button onClick={() => setActiveStep(3)}>
                  Next: Requirements →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Requirements */}
        {activeStep === 3 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle>Requirements</CardTitle>
                  <CardDescription>Education, experience, and skills</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Education Required</Label>
                  <Select value={educationRequired} onValueChange={setEducationRequired}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="bachelors">Bachelor's Degree</SelectItem>
                      <SelectItem value="masters">Master's Degree</SelectItem>
                      <SelectItem value="phd">PhD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expMin">Min Experience (years)</Label>
                  <Input
                    id="expMin"
                    type="number"
                    value={experienceMin}
                    onChange={(e) => setExperienceMin(e.target.value)}
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expMax">Max Experience (years)</Label>
                  <Input
                    id="expMax"
                    type="number"
                    value={experienceMax}
                    onChange={(e) => setExperienceMax(e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Must-Have Skills
                  {isGeneratingSkills && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
                </Label>
                <SkillInput
                  skills={skillsMustHave}
                  setSkills={setSkillsMustHave}
                  placeholder={isGeneratingSkills ? 'Generating skills...' : 'Type a skill and press Enter (e.g., Python)'}
                  disabled={isGeneratingSkills}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Nice-to-Have Skills
                  {isGeneratingSkills && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
                </Label>
                <SkillInput
                  skills={skillsNiceToHave}
                  setSkills={setSkillsNiceToHave}
                  placeholder={isGeneratingSkills ? 'Generating skills...' : 'Type a skill and press Enter (e.g., Docker)'}
                  disabled={isGeneratingSkills}
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setActiveStep(2)}>
                  ← Back
                </Button>
                <Button onClick={() => setActiveStep(4)}>
                  Next: AI Context →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: AI Context */}
        {activeStep === 4 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle>AI Context</CardTitle>
                  <CardDescription>Help the AI understand what you're looking for</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Card className="bg-muted/50 border-yellow-500/20">
                <CardContent className="pt-4">
                  <p className="text-sm">
                    <Sparkles className="w-4 h-4 inline mr-2 text-yellow-400" />
                    These fields help the AI personalize interview questions and better evaluate candidates.
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="projectContext">Project Context</Label>
                <p className="text-muted-foreground text-sm">
                  What will this person actually work on? Be specific.
                </p>
                <Textarea
                  id="projectContext"
                  value={projectContext}
                  onChange={(e) => setProjectContext(e.target.value)}
                  rows={4}
                  placeholder="e.g., Building internal dashboards and agentic AI systems to 100x performance across marketing channels..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idealCandidate">Ideal Candidate Profile</Label>
                <p className="text-muted-foreground text-sm">
                  Describe the perfect hire in your own words.
                </p>
                <Textarea
                  id="idealCandidate"
                  value={idealCandidate}
                  onChange={(e) => setIdealCandidate(e.target.value)}
                  rows={4}
                  placeholder="e.g., A hungry recent graduate who has SHIPPED something real — an internship project, a side project with users..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="redFlags">
                  <AlertTriangle className="w-4 h-4 inline mr-1 text-destructive" />
                  Red Flags to Watch For
                </Label>
                <p className="text-muted-foreground text-sm">
                  What should automatically disqualify a candidate?
                </p>
                <Textarea
                  id="redFlags"
                  value={redFlags}
                  onChange={(e) => setRedFlags(e.target.value)}
                  rows={3}
                  placeholder="e.g., Pure academics with ZERO business experience. If their resume only shows coursework and GPA..."
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setActiveStep(3)}>
                  ← Back
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Job Description
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Review & Publish */}
        {activeStep === 5 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle>Review & Publish</CardTitle>
                  <CardDescription>Review the generated description and publish</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Card */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Title</p>
                    <p className="font-medium">{title || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Location</p>
                    <p className="font-medium">{location} ({workArrangement})</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Salary</p>
                    <p className="font-medium">
                      {salaryMin && salaryMax ? `${salaryCurrency} ${salaryMin}-${salaryMax}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Visa</p>
                    <p className={`font-medium ${visaSponsorship ? 'text-emerald-400' : ''}`}>
                      {visaSponsorship ? 'Sponsorship Available' : 'Not Available'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Generated Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Generated Job Description
                  <span className="text-muted-foreground font-normal ml-2">(editable)</span>
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={16}
                  placeholder="Click 'Generate Job Description' in the previous step to create the JD..."
                  className="font-mono text-sm"
                />
              </div>

              {/* Citations */}
              {citations.length > 0 && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    Sources Referenced ({citations.length})
                  </Label>
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4 space-y-2">
                      {citations.map((citation, i) => (
                        <a
                          key={i}
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors group"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                          <span className="truncate">{citation.title}</span>
                        </a>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* AI Refinement */}
              {description && (
                <div className="space-y-3 border border-zinc-700 rounded-lg p-4 bg-zinc-900/40">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Wand2 className="w-4 h-4 text-violet-400" />
                    Refine with AI
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Not happy with something? Describe the changes you want and the AI will update the JD.
                  </p>
                  <Textarea
                    value={refinePrompt}
                    onChange={(e) => setRefinePrompt(e.target.value)}
                    placeholder='e.g. "Make the tone more casual", "Add a section on remote work policy", "Shorten the requirements list to 5 bullet points"'
                    rows={3}
                    className="text-sm resize-none"
                    disabled={isRefining}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRefine();
                    }}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleRefine}
                      disabled={isRefining || !refinePrompt.trim()}
                      variant="outline"
                      className="border-violet-600 text-violet-400 hover:bg-violet-600/10 hover:text-violet-300"
                    >
                      {isRefining ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Refining...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          Apply Changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setActiveStep(4)}>
                  ← Back to Edit
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={isPublishing || !description}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Publish Job
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* Add Location Dialog */}
      <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
            <DialogDescription>Add a country and optionally a city with its currency.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Country <span className="text-destructive">*</span></Label>
              <Input
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                placeholder="e.g., Indonesia"
              />
            </div>
            <div className="space-y-2">
              <Label>City <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                placeholder="e.g., Jakarta"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency Code <span className="text-destructive">*</span></Label>
                <Input
                  value={newCurrencyCode}
                  onChange={(e) => setNewCurrencyCode(e.target.value.toUpperCase())}
                  placeholder="e.g., IDR"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency Name <span className="text-destructive">*</span></Label>
                <Input
                  value={newCurrencyName}
                  onChange={(e) => setNewCurrencyName(e.target.value)}
                  placeholder="e.g., Indonesian Rupiah"
                />
              </div>
            </div>
            {currencies.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Or pick an existing currency:</p>
                <div className="flex flex-wrap gap-1.5">
                  {currencies.map(c => (
                    <Badge
                      key={c.code}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => {
                        setNewCurrencyCode(c.code);
                        const match = locations.find(l => l.currency_code === c.code);
                        if (match) setNewCurrencyName(match.currency_name);
                      }}
                    >
                      {c.code}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLocation(false)}>Cancel</Button>
            <Button
              onClick={handleAddLocation}
              disabled={!newCountry.trim() || !newCurrencyCode.trim() || !newCurrencyName.trim() || isSavingLocation}
            >
              {isSavingLocation ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</>
              ) : (
                'Add Location'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Currency Dialog */}
      <Dialog open={showAddCurrency} onOpenChange={setShowAddCurrency}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Currency</DialogTitle>
            <DialogDescription>Add a currency not in the list. This will also create a location entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Currency Code <span className="text-destructive">*</span></Label>
              <Input
                value={addCurrencyCode}
                onChange={(e) => setAddCurrencyCode(e.target.value.toUpperCase())}
                placeholder="e.g., IDR"
                maxLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency Name <span className="text-destructive">*</span></Label>
              <Input
                value={addCurrencyName}
                onChange={(e) => setAddCurrencyName(e.target.value)}
                placeholder="e.g., Indonesian Rupiah"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCurrency()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCurrency(false)}>Cancel</Button>
            <Button
              onClick={handleAddCurrency}
              disabled={!addCurrencyCode.trim() || !addCurrencyName.trim() || isSavingLocation}
            >
              {isSavingLocation ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</>
              ) : (
                'Add Currency'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Company Dialog */}
      <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Company</DialogTitle>
            <DialogDescription>
              Company info helps the AI write a compelling &quot;About&quot; section in the job description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyName"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="e.g., Printerpix"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAbout">
                About / What We Do <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="companyAbout"
                value={newCompanyAbout}
                onChange={(e) => setNewCompanyAbout(e.target.value)}
                rows={3}
                placeholder="e.g., We turn cherished memories into personalized photo products — mugs, canvases, phone cases — shipped to millions worldwide."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyIndustry">Industry</Label>
                <Input
                  id="companyIndustry"
                  value={newCompanyIndustry}
                  onChange={(e) => setNewCompanyIndustry(e.target.value)}
                  placeholder="e.g., E-commerce / Print"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyWebsite">Website</Label>
                <Input
                  id="companyWebsite"
                  value={newCompanyWebsite}
                  onChange={(e) => setNewCompanyWebsite(e.target.value)}
                  placeholder="e.g., printerpix.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyHQ">Headquarters</Label>
                <Input
                  id="companyHQ"
                  value={newCompanyHeadquarters}
                  onChange={(e) => setNewCompanyHeadquarters(e.target.value)}
                  placeholder="e.g., Dubai, UAE"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companySize">Company Size</Label>
                <Input
                  id="companySize"
                  value={newCompanySize}
                  onChange={(e) => setNewCompanySize(e.target.value)}
                  placeholder="e.g., 50-200 employees"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyCulture">Culture & Values</Label>
              <Textarea
                id="companyCulture"
                value={newCompanyCulture}
                onChange={(e) => setNewCompanyCulture(e.target.value)}
                rows={2}
                placeholder="e.g., Move fast, ship daily, data-driven. Small team, big ownership."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCompany(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newCompanyName.trim() || !newCompanyAbout.trim() || isSavingCompany}
              onClick={async () => {
                setIsSavingCompany(true);
                try {
                  const { data, error } = await supabase.from('companies').insert({
                    name: newCompanyName.trim(),
                    about: newCompanyAbout.trim(),
                    industry: newCompanyIndustry.trim() || null,
                    website: newCompanyWebsite.trim() || null,
                    headquarters: newCompanyHeadquarters.trim() || null,
                    size: newCompanySize.trim() || null,
                    culture: newCompanyCulture.trim() || null,
                  }).select().single();

                  if (error) throw error;

                  const newCompany = data as Company;
                  setCompanies(prev => [...prev, newCompany].sort((a, b) => a.name.localeCompare(b.name)));
                  setSelectedCompanyId(newCompany.id);

                  // Reset form
                  setNewCompanyName('');
                  setNewCompanyAbout('');
                  setNewCompanyIndustry('');
                  setNewCompanyWebsite('');
                  setNewCompanyHeadquarters('');
                  setNewCompanySize('');
                  setNewCompanyCulture('');
                  setShowAddCompany(false);
                } catch (err) {
                  console.error('Failed to save company:', err);
                  setMessage({ type: 'error', text: 'Failed to save company. Try again.' });
                } finally {
                  setIsSavingCompany(false);
                }
              }}
            >
              {isSavingCompany ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Company'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
