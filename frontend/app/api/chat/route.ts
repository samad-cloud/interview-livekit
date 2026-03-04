import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ConversationEntry {
  role: 'interviewer' | 'candidate';
  speaker: string;
  text: string;
}

export async function POST(request: Request) {
  try {
    const { message, systemPrompt, history, minutesElapsed, isWrappingUp } = await request.json();

    if (!message || !systemPrompt) {
      return NextResponse.json(
        { error: 'Missing message or systemPrompt' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('Missing GEMINI_API_KEY');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Build conversation context
    let conversationContext = '';
    if (history && Array.isArray(history) && history.length > 0) {
      conversationContext = '\n\n=== CONVERSATION SO FAR ===\n';
      history.forEach((entry: ConversationEntry) => {
        const label = entry.role === 'interviewer' ? 'INTERVIEWER' : 'CANDIDATE';
        conversationContext += `${label}: ${entry.text}\n`;
      });
      conversationContext += '=== END CONVERSATION ===\n';
    }

    // Build time context
    let timeContext = '';
    if (typeof minutesElapsed === 'number') {
      timeContext = `\n=== TIME STATUS ===\nElapsed: ${minutesElapsed} minutes of 15-minute interview.\n`;
      if (isWrappingUp) {
        timeContext += `STATUS: TIME IS ALMOST UP. You MUST wrap up NOW. Deliver a brief, warm closing statement thanking the candidate, and end your response with the exact token [END_INTERVIEW].\n`;
      }
      timeContext += `=== END TIME STATUS ===\n`;
    }

    // Full prompt - VERY explicit about roles
    const fullPrompt = `=== CRITICAL INSTRUCTION ===
YOU ARE THE INTERVIEWER. You are asking questions.
THE CANDIDATE is the person being interviewed. They are answering your questions.
NEVER describe your own experience or background. You have none. You only ask questions.

${systemPrompt}
${conversationContext}
${timeContext}
=== WHAT THE CANDIDATE JUST SAID ===
"${message}"

=== YOUR TASK ===
Generate ONLY what the interviewer (you) would say next.
- Ask a follow-up question or probe deeper
- Keep it to 1-3 sentences
- Be conversational, not robotic
- NEVER say "I have experience in..." or describe YOUR work - you are the interviewer, not the candidate
- Do NOT use asterisks, markdown, or stage directions
- When you feel you have covered enough ground OR when told time is running low, deliver a brief closing statement and end your response with the exact token [END_INTERVIEW]
- Only use [END_INTERVIEW] when you are genuinely done — do not use it mid-conversation

YOUR RESPONSE:`;

    const result = await model.generateContent(fullPrompt);
    const reply = result.response.text().trim();

    // Clean up any markdown or formatting that slipped through
    const cleanReply = reply
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^["']|["']$/g, '')
      .trim();

    return NextResponse.json({ reply: cleanReply });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}

