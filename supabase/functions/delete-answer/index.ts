// Deletes one of the signed-in person's own answers (screens 06kb / 06kc). The
// database removes the answer and keeps an emptied, cancelled recording row so
// the daily recording limit still counts it. Then this function asks Mux to
// delete the video file. There is no undo.
import { corsHeaders, json } from '../_shared/http.ts';
import { muxClient, userClient } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  let body: { answer_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send the answer to delete.' }, 400);
  }
  if (!body.answer_id) return json({ error: 'Send the answer to delete.' }, 400);

  const { data, error } = await userClient(req).rpc('delete_my_answer', { p_answer_id: body.answer_id });
  if (error) {
    const status = error.code === '28000' ? 401 : error.code === 'P0002' ? 404 : 400;
    return json({ error: error.message }, status);
  }

  if (data) {
    try {
      await muxClient().video.assets.delete(String(data));
    } catch (e) {
      console.error('Mux delete failed', data, e);
    }
  }
  return json({ ok: true });
});
