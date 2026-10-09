// Gives short-lived signed links to watch a video:
//   * { video_id }  the signed-in owner's own finished recording (to review it);
//   * { answer_id } a submitted answer: the owner's own any time, or somebody
//     else's only if the database says the caller may (the daily gate is open,
//     the answer is live, and neither person has blocked the other).
//   * { as_admin: true, video_id or answer_id } an admin watching any ready
//     video, including one that flags have hidden. That watch does not count
//     as a view. The database checks the admin list; this function only signs
//     the link.
import { corsHeaders, isUuid, json } from '../_shared/http.ts';
import { imageBaseUrl, muxClient, streamBaseUrl, userClient } from '../_shared/clients.ts';

const LINK_LIFETIME = '1h';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const body = await req.json().catch(() => null);
  const asAdmin = body?.as_admin === true;
  const byAnswer = !asAdmin && body?.answer_id !== undefined;
  if (!asAdmin && !isUuid(byAnswer ? body.answer_id : body?.video_id)) {
    return json({ error: 'video_id or answer_id is required.' }, 400);
  }
  if (asAdmin && !isUuid(body?.video_id) && !isUuid(body?.answer_id)) {
    return json({ error: 'video_id or answer_id is required.' }, 400);
  }

  const { data, error } = asAdmin
    ? await userClient(req).rpc('admin_get_video_for_playback', {
        p_video_id: isUuid(body.video_id) ? body.video_id : null,
        p_answer_id: isUuid(body.answer_id) ? body.answer_id : null,
      })
    : byAnswer
      ? await userClient(req).rpc('get_answer_for_playback', { p_answer_id: body.answer_id })
      : await userClient(req).rpc('get_my_video_for_playback', { p_video_id: body.video_id });
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
