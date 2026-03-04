import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Default model for most operations (fast)
export const gemini = google('gemini-2.5-flash');

// Model for complex reasoning tasks
export const geminiPro = google('gemini-2.5-pro');
