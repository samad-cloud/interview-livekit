import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer service role key (bypasses RLS) — falls back to anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Recording] Missing Supabase env vars');
    return NextResponse.json({ success: false, error: 'Server config error' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const candidateId = formData.get('candidateId') as string;
    const chunkIndex  = formData.get('chunkIndex') as string;
    const round       = formData.get('round') as string;
    // Strip codec specifier — Supabase only accepts base MIME types (e.g. video/webm not video/webm;codecs=vp9)
    const mimeType    = ((formData.get('mimeType') as string) || 'video/webm').split(';')[0].trim();
    const chunk       = formData.get('chunk') as File | null;

    if (!candidateId || chunkIndex === null || !round || !chunk) {
      console.error('[Recording] Save chunk — missing fields', { candidateId, chunkIndex, round, hasChunk: !!chunk });
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    const chunkBuffer = await chunk.arrayBuffer();
    const sizeKB = (chunkBuffer.byteLength / 1024).toFixed(1);
    const folder = round === '2' ? 'round2' : 'round1';
    const filePath = `chunks/${folder}/${candidateId}/chunk_${chunkIndex}.webm`;

    console.log(`[Recording] Chunk ${chunkIndex} received — candidate ${candidateId} (Round ${round}), size: ${sizeKB}KB, type: ${mimeType}`);

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.storage
      .from('interview-recordings')
      .upload(filePath, new Uint8Array(chunkBuffer), {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error(`[Recording] Chunk ${chunkIndex} upload FAILED — candidate ${candidateId} (Round ${round}): ${error.message}`);
      return NextResponse.json({ success: false, error: error.message });
    }

    console.log(`[Recording] Chunk ${chunkIndex} saved — candidate ${candidateId} (Round ${round})`);
    return NextResponse.json({ success: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Recording] Chunk upload exception: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
