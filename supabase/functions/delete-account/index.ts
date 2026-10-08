// Permanently deletes the signed-in person's account (profile, photos, videos,
// chats, matches) and then asks Mux to delete their video files. Moderation
// records stay, with names removed. There is no undo.
import { corsHeaders, json } from '../_shared/http.ts';
import { muxClient, serviceClient, userClient } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const asUser = userClient(req);
  const { data: who, error: whoError } = await asUser.auth.getUser();
  if (whoError || !who.user) return json({ error: 'Not signed in.' }, 401);

  const { data, error } = await asUser.rpc('delete_account');
  if (error) {
    const status = error.code === '28000' ? 401 : 400;
    return json({ error: error.message }, status);
  }

  const server = serviceClient();
  const folder = await server.storage.from('profile-photos').list(who.user.id);
  if (folder.data?.length) {
    await server.storage.from('profile-photos').remove(folder.data.map((f) => `${who.user.id}/${f.name}`));
  }

  const mux = muxClient();
  for (const row of (data ?? []) as { mux_asset_id: string }[]) {
    if (!row.mux_asset_id) continue;
    try {
      await mux.video.assets.delete(row.mux_asset_id);
    } catch (e) {
      console.error('Mux delete failed', row.mux_asset_id, e);
    }
  }
  return json({ ok: true });
});
