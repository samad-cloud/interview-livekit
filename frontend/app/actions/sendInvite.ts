'use server';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { generateDossier } from './generateDossier';

const INTERVIEW_BASE_URL = 'https://printerpix-recruitment.vercel.app/interview';
const ROUND2_BASE_URL = 'https://printerpix-recruitment.vercel.app/round2';
const COMPANY_NAME = 'Printerpix';

/** Replace {variable} placeholders in a template string. */
function interpolateEmail(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template
  );
}

/** Fetch a single email template from the prompts table. Returns null if unavailable. */
async function fetchEmailTemplate(supabase: SupabaseClient, name: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('prompts')
      .select('system_prompt')
      .eq('name', name)
      .single();
    return data?.system_prompt ?? null;
  } catch {
    return null;
  }
}

// Minimal fallback HTML used if the DB template is unavailable.
// The canonical versions live in the prompts table (email_round1_invite, email_round2_invite).
const ROUND1_INVITE_FALLBACK_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#faf5f7;padding:40px 16px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
<div style="background:#c30361;padding:28px 36px;"><h1 style="margin:0;color:#fff;font-size:22px;">{company_name}</h1></div>
<div style="padding:32px 36px;">
<p style="color:#c30361;font-size:22px;font-weight:700;">Thank you for applying! You're invited to your first interview at {company_name}</p>
<p>Hi {first_name},</p>
<p>At {company_name}, we use our own AI system to make hiring faster, fairer, and more focused on you. The interview typically takes 15–20 minutes. Find a quiet spot, relax, and let your experience speak for itself.</p>
<p style="text-align:center;margin:28px 0;"><a href="{interview_link}" style="background:#c30361;color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:700;">Start Your Interview →</a></p>
<p style="color:#6b7280;font-size:13px;">Issues? Email <a href="mailto:printerpix.recruitment@gmail.com">printerpix.recruitment@gmail.com</a></p>
</div>
<div style="background:#1f2937;padding:24px 36px;color:rgba(255,255,255,0.85);font-size:13px;">Best regards, John Poole — Recruitment Manager, {company_name}</div>
</div></body></html>`;

const ROUND2_INVITE_FALLBACK_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#faf5f7;padding:40px 16px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
<div style="background:#c30361;padding:28px 36px;"><h1 style="margin:0;color:#fff;font-size:22px;">{company_name}</h1></div>
<div style="padding:32px 36px;">
<p style="color:#c30361;font-size:22px;font-weight:700;">The Next Milestone: Your Technical Deep Dive</p>
<p>Hi {first_name},</p>
<p>Thank you for completing the first stage. We were truly impressed and are excited to invite you to a Technical Deep Dive — roughly 30–40 minutes focused on the <strong>{job_title}</strong> role. Complete within 48 hours to stay on the fast track.</p>
<p style="text-align:center;margin:28px 0;"><a href="{round2_link}" style="background:#c30361;color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:700;">Start Technical Interview →</a></p>
<p style="color:#6b7280;font-size:13px;">Issues? Email <a href="mailto:printerpix.recruitment@gmail.com">printerpix.recruitment@gmail.com</a></p>
</div>
<div style="background:#1f2937;padding:24px 36px;color:rgba(255,255,255,0.85);font-size:13px;">Best regards, John Poole — Recruitment Manager, {company_name}</div>
</div></body></html>`;

interface SendInviteResult {
  success: boolean;
  error?: string;
}

// Initialize Gmail API using OAuth2 credentials from environment
function getGmailService() {
  const tokenJson = process.env.GOOGLE_TOKEN_JSON;
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  console.log('[Gmail Init] GOOGLE_TOKEN_JSON present:', !!tokenJson, '| length:', tokenJson?.length ?? 0);
  console.log('[Gmail Init] GOOGLE_CREDENTIALS_JSON present:', !!credentialsJson, '| length:', credentialsJson?.length ?? 0);

  if (!tokenJson || !credentialsJson) {
    console.log('[Gmail Init] MISSING env vars — cannot initialize Gmail');
    return null;
  }

  try {
    const token = JSON.parse(tokenJson);
    const credentials = JSON.parse(credentialsJson);
    const clientConfig = credentials.installed || credentials.web || {};

    console.log('[Gmail Init] Credential type:', credentials.installed ? 'installed (desktop)' : credentials.web ? 'web' : 'unknown');
    console.log('[Gmail Init] Client ID:', clientConfig.client_id?.slice(0, 20) + '...');
    console.log('[Gmail Init] Has client_secret:', !!clientConfig.client_secret);
    console.log('[Gmail Init] Has access_token:', !!token.token);
    console.log('[Gmail Init] Has refresh_token:', !!token.refresh_token);
    console.log('[Gmail Init] Token expiry:', token.expiry || token.expiry_date || 'not set');

    const oauth2Client = new google.auth.OAuth2(
      clientConfig.client_id,
      clientConfig.client_secret,
      'http://localhost'
    );

    oauth2Client.setCredentials({
      access_token: token.token,
      refresh_token: token.refresh_token,
      token_type: 'Bearer',
    });

    console.log('[Gmail Init] OAuth2 client created successfully');
    return google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (error) {
    console.error('[Gmail Init] Failed to initialize:', error);
    return null;
  }
}

// Create email message for Gmail API
function createEmail(to: string, subject: string, htmlBody: string): string {
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ];
  
  const email = emailLines.join('\r\n');
  return Buffer.from(email).toString('base64url');
}

export async function sendInterviewInvite(candidateId: number): Promise<SendInviteResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: 'Supabase not configured' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate with job info
    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('email, full_name, interview_token, job_id')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    if (!candidate.interview_token) {
      return { success: false, error: 'No interview token found' };
    }

    // Get job title
    let jobTitle = 'Open Position';
    if (candidate.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', candidate.job_id)
        .single();
      if (job) {
        jobTitle = job.title;
      }
    }

    const interviewLink = `${INTERVIEW_BASE_URL}/${candidate.interview_token}`;
    const firstName = candidate.full_name?.split(' ')[0] || candidate.full_name || 'there';

    // Send email via Gmail API
    console.log(`[Send Invite] Attempting to send Round 1 invite to ${candidate.email} (candidate ${candidateId})`);
    console.log(`[Send Invite] Job: "${jobTitle}" | Token: ${candidate.interview_token?.slice(0, 8)}...`);
    console.log(`[Send Invite] Interview link: ${interviewLink}`);

    const gmail = getGmailService();
    if (gmail) {
      try {
        const template = await fetchEmailTemplate(supabase, 'email_round1_invite');
        const htmlBody = interpolateEmail(template ?? ROUND1_INVITE_FALLBACK_HTML, {
          first_name: firstName,
          interview_link: interviewLink,
          company_name: COMPANY_NAME,
        });

        const rawMessage = createEmail(
          candidate.email,
          `You're Invited - AI Interview for ${jobTitle} at ${COMPANY_NAME}`,
          htmlBody
        );

        console.log(`[Send Invite] Sending via Gmail API...`);
        const result = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawMessage },
        });

        console.log(`[Send Invite] SUCCESS — Gmail message ID: ${result.data.id}, threadId: ${result.data.threadId}`);
      } catch (emailError: unknown) {
        const err = emailError as { code?: number; message?: string; errors?: unknown[] };
        console.error('[Send Invite] Gmail FAILED:', {
          code: err.code,
          message: err.message,
          errors: err.errors,
          full: emailError,
        });
        return { success: false, error: `Gmail send failed: ${err.message || 'Unknown error'}` };
      }
    } else {
      console.log(`[Send Invite] No Gmail service available — skipping email send`);
    }

    // Update candidate status
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ status: 'INVITE_SENT', invite_sent_at: new Date().toISOString() })
      .eq('id', candidateId);

    if (updateError) {
      return { success: false, error: 'Failed to update status' };
    }

    return { success: true };
  } catch (error) {
    console.error('Send invite error:', error);
    return { success: false, error: 'Failed to send invite' };
  }
}

export async function inviteToRound2(candidateId: number): Promise<SendInviteResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: 'Supabase not configured' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate with job info
    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('email, full_name, interview_token, job_id, rating')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    // Get job title
    let jobTitle = 'Open Position';
    if (candidate.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', candidate.job_id)
        .single();
      if (job) {
        jobTitle = job.title;
      }
    }

    const round2Link = `${ROUND2_BASE_URL}/${candidate.interview_token}`;
    const firstName = candidate.full_name?.split(' ')[0] || candidate.full_name || 'there';

    // Generate dossier with probe questions from Round 1 transcript
    console.log(`[Round 2 Invite] Generating dossier for candidate ${candidateId}...`);
    const dossierResult = await generateDossier(String(candidateId));
    if (!dossierResult.success) {
      console.warn(`[Round 2 Invite] Dossier generation failed: ${dossierResult.error} - proceeding without dossier`);
    } else {
      console.log(`[Round 2 Invite] Generated ${dossierResult.dossier?.length || 0} probe questions`);
    }

    // Send email via Gmail API
    console.log(`[Round 2 Invite] Attempting to send Round 2 invite to ${candidate.email} (candidate ${candidateId})`);
    console.log(`[Round 2 Invite] Job: "${jobTitle}" | Rating: ${candidate.rating} | Token: ${candidate.interview_token?.slice(0, 8)}...`);
    console.log(`[Round 2 Invite] Round 2 link: ${round2Link}`);

    const gmail = getGmailService();
    if (gmail) {
      try {
        const template = await fetchEmailTemplate(supabase, 'email_round2_invite');
        const htmlBody = interpolateEmail(template ?? ROUND2_INVITE_FALLBACK_HTML, {
          first_name: firstName,
          round2_link: round2Link,
          job_title: jobTitle,
          company_name: COMPANY_NAME,
        });

        const rawMessage = createEmail(
          candidate.email,
          `Great news about your ${COMPANY_NAME} application`,
          htmlBody
        );

        console.log(`[Round 2 Invite] Sending via Gmail API...`);
        const result = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawMessage },
        });

        console.log(`[Round 2 Invite] SUCCESS — Gmail message ID: ${result.data.id}, threadId: ${result.data.threadId}`);
      } catch (emailError: unknown) {
        const err = emailError as { code?: number; message?: string; errors?: unknown[] };
        console.error('[Round 2 Invite] Gmail FAILED:', {
          code: err.code,
          message: err.message,
          errors: err.errors,
          full: emailError,
        });
        return { success: false, error: `Gmail send failed: ${err.message || 'Unknown error'}` };
      }
    } else {
      console.log(`[Round 2 Invite] No Gmail service available — skipping email send`);
    }

    // Update to round 2
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        current_stage: 'round_2',
        status: 'ROUND_2_INVITED',
        invite_sent_at: new Date().toISOString()
      })
      .eq('id', candidateId);

    if (updateError) {
      return { success: false, error: 'Failed to update status' };
    }

    return { success: true };
  } catch (error) {
    console.error('Invite to round 2 error:', error);
    return { success: false, error: 'Failed to invite to round 2' };
  }
}
