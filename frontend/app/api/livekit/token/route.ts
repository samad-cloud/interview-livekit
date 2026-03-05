import { NextRequest, NextResponse } from 'next/server';
import {
  AccessToken,
  AgentDispatchClient,
  EgressClient,
  EncodedFileOutput,
  RoomServiceClient,
  S3Upload,
} from 'livekit-server-sdk';

export async function POST(req: NextRequest) {
  const {
    candidateId,
    round,
    candidateName,
    jobTitle,
    jobDescription,
    resumeText,
    dossier,
    systemPrompt,
  } = await req.json();

  if (!candidateId || !round) {
    return NextResponse.json({ error: 'Missing candidateId or round' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const livekitUrl = process.env.LIVEKIT_URL!;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
  }

  const baseRoomName = `interview-${candidateId}-r${round}`;
  // Include random suffix to prevent collisions if called twice within the same millisecond
  const roomName = `${baseRoomName}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);

  // Delete ALL existing rooms for this candidate+round (handles both legacy names and
  // previous timestamped names). This prevents stale agents from the previous session
  // racing into the new room — even if deleteRoom finishes before the agent disconnects,
  // the agent can't rejoin because the new room has a different (timestamped) name.
  try {
    const allRooms = await roomService.listRooms();
    const oldRooms = allRooms.filter(r => r.name.startsWith(baseRoomName));
    await Promise.all(oldRooms.map(r => roomService.deleteRoom(r.name).catch(() => {})));
    if (oldRooms.length > 0) {
      console.log(`[LiveKit] Deleted ${oldRooms.length} old room(s) for ${baseRoomName}`);
    }
  } catch {
    // listRooms failed — proceed anyway
  }

  // Metadata embedded in room — agent reads this to configure itself
  const roomMetadata = JSON.stringify({
    candidateId,
    round,
    candidateName,
    jobTitle,
    jobDescription,
    resumeText,
    dossier: dossier || null,
    systemPrompt: systemPrompt || null,
  });

  // Create a fresh room
  await roomService.createRoom({
    name: roomName,
    emptyTimeout: 300,
    maxParticipants: 3,
    metadata: roomMetadata,
  });
  console.log(`[LiveKit] Created fresh room ${roomName}`);

  // Dispatch agent — check for existing dispatches first to prevent duplicates
  try {
    const agentDispatch = new AgentDispatchClient(livekitUrl, apiKey, apiSecret);
    const existingDispatches = await agentDispatch.listDispatches(roomName).catch(() => []);
    if (existingDispatches.length === 0) {
      await agentDispatch.createDispatch(roomName, '');
      console.log(`[LiveKit] Agent dispatched to room ${roomName}`);
    } else {
      console.log(`[LiveKit] Agent already dispatched to room ${roomName} — skipping duplicate`);
    }
  } catch (err) {
    console.error('[LiveKit] Agent dispatch failed:', err);
  }

  // Issue candidate participant token
  const at = new AccessToken(apiKey, apiSecret, {
    identity: `candidate-${candidateId}`,
    name: candidateName,
    ttl: 7200,
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  // Start Egress recording
  let egressId: string | null = null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseS3Key = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const supabaseS3Secret = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  const supabaseProjectRef = supabaseUrl?.match(/https:\/\/([^.]+)/)?.[1];

  if (supabaseS3Key && supabaseS3Secret && supabaseProjectRef) {
    try {
      const egressClient = new EgressClient(livekitUrl, apiKey, apiSecret);
      const folder = round === 2 ? 'round2' : 'round1';
      const filename = `${folder}/${candidateId}-${Date.now()}-livekit`;

      const fileOutput = new EncodedFileOutput({
        filepath: `${filename}.mp4`,
        output: {
          case: 's3',
          value: new S3Upload({
            accessKey: supabaseS3Key,
            secret: supabaseS3Secret,
            bucket: 'interview-recordings',
            endpoint: `https://${supabaseProjectRef}.supabase.co/storage/v1/s3`,
            region: 'us-east-1',
            forcePathStyle: true,
          }),
        },
      });

      const egress = await egressClient.startRoomCompositeEgress(
        roomName,
        fileOutput,
        { layout: 'speaker' },
      );

      egressId = egress.egressId;
      console.log(`[LiveKit] Egress started: ${egressId} for candidate ${candidateId} R${round}`);
    } catch (err) {
      console.error('[LiveKit] Egress start failed:', err);
    }
  } else {
    console.warn('[LiveKit] Supabase S3 credentials not set — recording disabled');
  }

  return NextResponse.json({
    token,
    serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    roomName,
    egressId,
  });
}
