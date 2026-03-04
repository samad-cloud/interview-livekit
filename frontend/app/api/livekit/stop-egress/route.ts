import { NextRequest, NextResponse } from 'next/server';
import { EgressClient } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { egressId, candidateId, round } = await req.json();

  if (!egressId) {
    return NextResponse.json({ success: false, error: 'No egressId' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const livekitUrl = process.env.LIVEKIT_URL!;

  try {
    const egressClient = new EgressClient(livekitUrl, apiKey, apiSecret);
    const egress = await egressClient.stopEgress(egressId);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fileOutput = egress.fileResults?.[0];
    if (fileOutput?.filename && candidateId && round) {
      const videoColumn = round === 2 ? 'round_2_video_url' : 'video_url';
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/interview-recordings/${fileOutput.filename}`;

      await supabase
        .from('candidates')
        .update({ [videoColumn]: publicUrl })
        .eq('id', candidateId);

      console.log(`[LiveKit] Egress stopped — recording at ${publicUrl}`);
      return NextResponse.json({ success: true, url: publicUrl });
    }

    return NextResponse.json({ success: true, url: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[LiveKit] Stop egress failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
