'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Settings2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Prompt {
  id: string;
  name: string;
  label: string;
  description: string | null;
  system_prompt: string;
  updated_at: string;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

  useEffect(() => {
    fetchPrompts();
  }, []);

  async function fetchPrompts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .order('name');

    if (error) {
      console.error('Failed to fetch prompts:', error);
    } else {
      setPrompts(data || []);
      // Initialize edited state with current values
      const initial: Record<string, string> = {};
      (data || []).forEach((p: Prompt) => {
        initial[p.id] = p.system_prompt;
      });
      setEdited(initial);
    }
    setLoading(false);
  }

  async function handleSave(prompt: Prompt) {
    const newText = edited[prompt.id];
    if (newText === prompt.system_prompt) {
      setMessages({ ...messages, [prompt.id]: { type: 'success', text: 'No changes to save.' } });
      setTimeout(() => setMessages((prev) => { const next = { ...prev }; delete next[prompt.id]; return next; }), 3000);
      return;
    }

    setSaving({ ...saving, [prompt.id]: true });

    const { error } = await supabase
      .from('prompts')
      .update({ system_prompt: newText, updated_at: new Date().toISOString() })
      .eq('id', prompt.id);

    if (error) {
      console.error('Failed to save prompt:', error);
      setMessages({ ...messages, [prompt.id]: { type: 'error', text: 'Failed to save. Please try again.' } });
    } else {
      setMessages({ ...messages, [prompt.id]: { type: 'success', text: 'Saved successfully!' } });
      // Update local state so the prompt object reflects the new value
      setPrompts((prev) =>
        prev.map((p) => (p.id === prompt.id ? { ...p, system_prompt: newText, updated_at: new Date().toISOString() } : p))
      );
    }

    setSaving({ ...saving, [prompt.id]: false });
    setTimeout(() => setMessages((prev) => { const next = { ...prev }; delete next[prompt.id]; return next; }), 3000);
  }

  const hasChanges = (prompt: Prompt) => edited[prompt.id] !== prompt.system_prompt;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Image src="/logo.jpg" alt="Logo" width={32} height={32} className="rounded" />
              <div>
                <h1 className="text-lg font-semibold flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-zinc-400" />
                  AI Prompts
                </h1>
                <p className="text-sm text-zinc-500">Edit AI interviewer prompts and outgoing email templates</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-400">
          <p>
            These prompts control how the AI interviews candidates and the emails sent throughout the hiring process. Use <code className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded">{'{variable_name}'}</code> placeholders
            for dynamic values — they will be replaced with actual candidate data at runtime.
          </p>
        </div>

        <div className="bg-amber-950/40 border border-amber-700/60 rounded-lg p-4 text-sm flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2 text-amber-200/80">
            <p className="font-semibold text-amber-300">Do not modify or remove variable placeholders</p>
            <p>
              The following placeholders are injected automatically at runtime. Renaming, deleting, or altering them in any way will cause the system to break.
            </p>
            <p className="text-amber-300 font-medium pt-1">AI Interview prompts:</p>
            <div className="flex flex-wrap gap-2">
              {['{candidateName}', '{jobDescription}', '{resumeText}', '{dossierQuestions}'].map((v) => (
                <code key={v} className="bg-amber-900/50 border border-amber-700/40 text-amber-300 px-2 py-0.5 rounded text-xs font-mono">
                  {v}
                </code>
              ))}
            </div>
            <p className="text-amber-300 font-medium pt-1">Email templates:</p>
            <div className="flex flex-wrap gap-2">
              {['{first_name}', '{company_name}', '{interview_link}', '{round2_link}', '{job_title}', '{role_title}', '{duration}', '{tally_url}'].map((v) => (
                <code key={v} className="bg-amber-900/50 border border-amber-700/40 text-amber-300 px-2 py-0.5 rounded text-xs font-mono">
                  {v}
                </code>
              ))}
            </div>
            <p className="text-amber-200/60 text-xs pt-1">
              Only edit the surrounding instructions and prose. Keep all placeholders exactly as they appear.
            </p>
          </div>
        </div>

        {prompts.map((prompt) => (
          <Card key={prompt.id} className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">{prompt.label}</CardTitle>
              {prompt.description && (
                <CardDescription className="text-zinc-400">{prompt.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={edited[prompt.id] || ''}
                onChange={(e) => setEdited({ ...edited, [prompt.id]: e.target.value })}
                className="min-h-[300px] bg-zinc-950 border-zinc-700 text-zinc-200 font-mono text-sm leading-relaxed resize-y"
                placeholder="Enter prompt template..."
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {messages[prompt.id] && (
                    <div className={`flex items-center gap-1.5 text-sm ${
                      messages[prompt.id].type === 'success' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {messages[prompt.id].type === 'success' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      {messages[prompt.id].text}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-600">
                    Last updated: {new Date(prompt.updated_at).toLocaleString()}
                  </span>
                  <Button
                    onClick={() => handleSave(prompt)}
                    disabled={saving[prompt.id] || !hasChanges(prompt)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                  >
                    {saving[prompt.id] ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
