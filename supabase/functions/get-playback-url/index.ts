// Gives the signed-in owner short-lived links to watch their own finished
// recording. (Watching other people's videos is added with the feed in Phase 4.)
import { corsHeaders, isUuid, json } from '../_shared/http.ts';
import { imageBaseUrl, muxClient, streamBaseUrl, userClient } from '../_shared/clients.ts';

const LINK_LIFETIME = '1h';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const body = await req.json().catch(() => null);
  if (!isUuid(body?.video_id)) return json({ error: 'video_id is required.' }, 400);

  const { data, error } = await userClient(req).rpc('get_my_video_for_playback', { p_video_id: body.video_id });
  if (error) return json({ error: error.message }, error.code === '42501' ? 401 : 400);
  const playbackId = data?.[0]?.mux_playback_id;
  if (!playbackId) return json({ error: 'That video is not available.' }, 404);

  const mux = muxClient();
  const tokens = await mux.jwt.signPlaybackId(playbackId, { type: ['video', 'thumbnail'], expiration: LINK_LIFETIME });
  return json({
    playback_url: `${streamBaseUrl()}/${playbackId}.m3u8?token=${tokens['playback-token']}`,
    thumbnail_url: `${imageBaseUrl()}/${playbackId}/thumbnail.jpg?token=${tokens['thumbnail-token']}`,
    expires_in_seconds: 3600,
  });
});
