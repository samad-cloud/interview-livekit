import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer service role key (bypasses RLS) — falls back to anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Recording] Finalize — missing Supabase env vars');
    return NextResponse.json({ success: false, error: 'Server config error' }, { status: 500 });
  }

  try {
    const { candidateId, round, chunkCount: rawChunkCount, mimeType: rawMime } = await req.json();
    // Strip codec specifier — Supabase only accepts base MIME types (e.g. video/webm not video/webm;codecs=vp9)
    const mimeType = (rawMime || 'video/webm').split(';')[0].trim();
    const fileExt  = mimeType.includes('mp4') ? 'mp4' : 'webm';

    if (!candidateId || !round) {
      console.error('[Recording] Finalize — missing fields', { candidateId, round });
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const folder = round === 2 ? 'round2' : 'round1';

    // Auto-detect chunk count from storage if not provided (e.g. manual stitch from dashboard)
    let chunkCount: number = typeof rawChunkCount === 'number' && rawChunkCount > 0 ? rawChunkCount : 0;
    if (chunkCount === 0) {
      const { data: fileList, error: listError } = await supabase.storage
        .from('interview-recordings')
        .list(`chunks/${folder}/${candidateId}`, { limit: 1000 });
      if (listError || !fileList || fileList.length === 0) {
        console.error(`[Recording] Finalize — could not list chunks for candidate ${candidateId} (Round ${round})`);
        return NextResponse.json({ success: false, error: 'No chunks found in storage' });
      }
      const indices = fileList
        .map(f => { const m = f.name.match(/^chunk_(\d+)\./); return m ? parseInt(m[1]) : -1; })
        .filter(i => i >= 0);
      chunkCount = indices.length > 0 ? Math.max(...indices) + 1 : 0;
      console.log(`[Recording] Auto-detected ${chunkCount} chunks (indices: ${indices.sort((a,b)=>a-b).join(',')}) — candidate ${candidateId} (Round ${round})`);
    }

    if (chunkCount === 0) {
      console.error(`[Recording] Finalize — no chunks found — candidate ${candidateId} (Round ${round})`);
      return NextResponse.json({ success: false, error: 'No chunks found in storage' });
    }

    console.log(`[Recording] Finalize started — candidate ${candidateId} (Round ${round}), expecting ${chunkCount} chunks`);

    // Download all chunks from Supabase in parallel
    const downloadResults = await Promise.all(
      Array.from({ length: chunkCount }, async (_, i) => {
        const path = `chunks/${folder}/${candidateId}/chunk_${i}.webm`;
        const { data, error } = await supabase.storage
          .from('interview-recordings')
          .download(path);

        if (error) {
          const reason = error.message || JSON.stringify(error);
          console.warn(`[Recording] Chunk ${i} download failed — candidate ${candidateId}: ${reason}`);
          return null;
        }
        return { index: i, blob: data };
      })
    );

    const valid = downloadResults.filter((r): r is { index: number; blob: Blob } => r !== null);
    console.log(`[Recording] Downloaded ${valid.length}/${chunkCount} chunks — candidate ${candidateId} (Round ${round})`);

    if (valid.length === 0) {
      console.error(`[Recording] No chunks available — candidate ${candidateId} (Round ${round})`);
      return NextResponse.json({ success: false, error: 'No chunks found in storage' });
    }

    // Sort by chunk index and concatenate into a single buffer
    valid.sort((a, b) => a.index - b.index);
    const buffers = await Promise.all(valid.map(r => r.blob.arrayBuffer()));
    const totalBytes = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const assembled = new Uint8Array(totalBytes);
    let offset = 0;
    for (const buf of buffers) {
      assembled.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    const sizeMB = (totalBytes / 1024 / 1024).toFixed(2);
    const uploadStart = Date.now();
    console.log(`[Recording] Assembled ${sizeMB}MB from ${valid.length} chunks — candidate ${candidateId}, uploading final file`);

    // Upload the assembled final file
    const timestamp = Date.now();
    const finalPath = `${folder}/${candidateId}-${timestamp}-final.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('interview-recordings')
      .upload(finalPath, assembled, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`[Recording] Final upload FAILED — candidate ${candidateId} (Round ${round}): ${uploadError.message}`);
      return NextResponse.json({ success: false, error: uploadError.message });
    }
    console.log(`[Recording] Upload complete — candidate ${candidateId}, ${sizeMB}MB in ${((Date.now() - uploadStart) / 1000).toFixed(1)}s`);

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('interview-recordings')
      .getPublicUrl(finalPath);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      console.error(`[Recording] Could not get public URL — candidate ${candidateId}`);
      return NextResponse.json({ success: false, error: 'Failed to get public URL' });
    }

    // Update the DB column
    const videoColumn = round === 2 ? 'round_2_video_url' : 'video_url';
    const { error: dbError } = await supabase
      .from('candidates')
      .update({ [videoColumn]: publicUrl })
      .eq('id', candidateId);

    if (dbError) {
      console.error(`[Recording] DB update FAILED — candidate ${candidateId} (Round ${round}): ${dbError.message}`);
      return NextResponse.json({ success: false, error: dbError.message });
    }

    console.log(`[Recording] Finalized — candidate ${candidateId} (Round ${round}), ${sizeMB}MB, ${valid.length}/${chunkCount} chunks, url: ${publicUrl}`);
    return NextResponse.json({ success: true, url: publicUrl });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Recording] Finalize exception — ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
