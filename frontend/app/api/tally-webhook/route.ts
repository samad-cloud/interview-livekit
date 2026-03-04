import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // Validate webhook secret
    const webhookSecret = process.env.TALLY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = request.headers.get('x-tally-webhook-secret');
      if (providedSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const payload = await request.json();

    // Tally webhook payload structure:
    // { eventId, eventType, createdAt, data: { responseId, submissionId, respondentId, formId, formName, createdAt, fields: [...] } }
    const { data } = payload;
    if (!data || !data.fields) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Extract interview_token from hidden field
    const tokenField = data.fields.find(
      (f: { label: string; value: string }) =>
        f.label?.toLowerCase() === 'interview_token' ||
        f.label?.toLowerCase() === 'interview token'
    );
    const interviewToken = tokenField?.value;

    if (!interviewToken) {
      console.error('[Tally Webhook] No interview_token found in submission', data.fields);
      return NextResponse.json({ error: 'Missing interview_token' }, { status: 400 });
    }

    // Helper: resolve Tally field value to human-readable text
    // For multiple choice / checkbox / dropdown fields, Tally sends option UUIDs in `value`
    // and includes an `options` array with { id, text } to map them back
    const resolveFieldValue = (field: { value: unknown; options?: { id: string; text: string }[] }): string => {
      if (!field.options || field.options.length === 0) {
        return field.value?.toString() || '';
      }
      // Single value (MULTIPLE_CHOICE, DROPDOWN)
      if (typeof field.value === 'string') {
        const match = field.options.find((o) => o.id === field.value);
        return match?.text || field.value;
      }
      // Array of values (CHECKBOXES)
      if (Array.isArray(field.value)) {
        return field.value
          .map((v: string) => {
            const match = field.options?.find((o) => o.id === v);
            return match?.text || v;
          })
          .join(', ');
      }
      return field.value?.toString() || '';
    };

    // Collect all form responses for audit (resolve option UUIDs to text)
    const formResponses: Record<string, string> = {};
    for (const field of data.fields) {
      if (field.label && field.label.toLowerCase() !== 'interview_token') {
        formResponses[field.label] = resolveFieldValue(field);
      }
    }

    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Tally Webhook] Missing Supabase credentials');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up candidate by interview_token
    const { data: candidate, error: lookupError } = await supabase
      .from('candidates')
      .select('id, email, full_name, status')
      .eq('interview_token', interviewToken)
      .single();

    if (lookupError || !candidate) {
      console.error('[Tally Webhook] Candidate not found for token:', interviewToken);
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Ignore resubmissions — only process if candidate is still in QUESTIONNAIRE_SENT status
    if (candidate.status !== 'QUESTIONNAIRE_SENT') {
      console.log(
        `[Tally Webhook] Ignoring resubmission for ${candidate.email} (current status: ${candidate.status})`
      );
      return NextResponse.json({ success: true, status: candidate.status, resubmission: true });
    }

    // All form completions proceed forward regardless of visa status
    const newStatus = 'FORM_COMPLETED';

    // Update candidate
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        status: newStatus,
        questionnaire_responses: formResponses,
      })
      .eq('id', candidate.id);

    if (updateError) {
      console.error('[Tally Webhook] Failed to update candidate:', updateError);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    console.log(
      `[Tally Webhook] Candidate ${candidate.email} → ${newStatus}`
    );

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('[Tally Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
