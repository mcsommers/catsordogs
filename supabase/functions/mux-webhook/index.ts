// Mux calls this address as a video moves through its pipeline (uploaded,
// processed, captions ready, ...). Nothing here is called by the app.
//
// Every request is checked against Mux's signature, so only Mux can use it.
// If something temporary goes wrong we answer with an error and Mux retries later.
import { isUuid, json } from '../_shared/http.ts';
import { muxClient, serviceClient, streamBaseUrl } from '../_shared/clients.ts';
import { parseVtt } from '../_shared/vtt.ts';

// deno-lint-ignore no-explicit-any
type Data = Record<string, any>;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const mux = muxClient();
  const body = await req.text();
  let event: { type: string; data: Data };
  try {
    // Throws unless the signature matches our webhook signing secret.
    event = (await mux.webhooks.unwrap(body, req.headers)) as unknown as { type: string; data: Data };
  } catch {
    return json({ error: 'Invalid signature.' }, 400);
  }

  try {
    await handleEvent(event.type, event.data, mux);
    return json({ ok: true });
  } catch (e) {
    console.error(`mux-webhook ${event.type} failed`, e);
    return json({ error: 'Temporary problem, please retry.' }, 500);
  }
});

async function handleEvent(type: string, data: Data, mux: ReturnType<typeof muxClient>) {
  const db = serviceClient();

  const must = async (call: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await call;
    if (error) throw new Error(error.message);
  };
  const videoByColumn = async (column: 'mux_upload_id' | 'mux_asset_id', value: string) => {
    const { data: row, error } = await db.from('videos').select('id, mux_playback_id').eq(column, value).maybeSingle();
    if (error) throw new Error(error.message);
    return row as { id: string; mux_playback_id: string | null } | null;
  };

  switch (type) {
    case 'video.upload.asset_created': {
      const video = await videoByColumn('mux_upload_id', data.id);
      if (video) await must(db.rpc('video_upload_asset_created', { p_video_id: video.id, p_mux_asset_id: data.asset_id }));
      return;
    }

    case 'video.upload.cancelled':
    case 'video.upload.errored': {
      const video = await videoByColumn('mux_upload_id', data.id);
      if (video) {
        await must(db.rpc('video_mark_failed', {
          p_video_id: video.id,
          p_new_status: type === 'video.upload.cancelled' ? 'cancelled' : 'failed',
        }));
      }
      return;
    }

    case 'video.asset.ready': {
      if (!isUuid(data.passthrough)) return; // not one of ours
      const { data: result, error } = await db.rpc('video_asset_ready', {
        p_video_id: data.passthrough,
        p_mux_asset_id: data.id,
        p_mux_playback_id: data.playback_ids?.[0]?.id ?? null,
        p_duration_seconds: data.duration ?? null,
      });
      if (error) throw new Error(error.message);
      // Too long: the database rejected it, so remove the file from Mux too.
      if (result === 'rejected') await mux.video.assets.delete(data.id);
      return;
    }

    case 'video.asset.errored': {
      if (isUuid(data.passthrough)) await must(db.rpc('video_mark_failed', { p_video_id: data.passthrough }));
      return;
    }

    case 'video.asset.track.ready': {
      // Only the automatic speech-to-text captions are interesting here.
      if (data.type !== 'text' || data.text_source !== 'generated_vod') return;
      const video = await videoByColumn('mux_asset_id', data.asset_id);
      if (!video) return;

      const asset = await mux.video.assets.retrieve(data.asset_id);
      const playbackId = asset.playback_ids?.[0]?.id;
      if (!playbackId) throw new Error('Asset has no playback id yet.');

      const token = await mux.jwt.signPlaybackId(playbackId, { type: 'video', expiration: '10m' });
      const res = await fetch(`${streamBaseUrl()}/${playbackId}/text/${data.id}.vtt?token=${token}`);
      if (!res.ok) throw new Error(`Caption download failed with status ${res.status}.`);

      await must(db.rpc('video_set_captions', { p_video_id: video.id, p_segments: parseVtt(await res.text()) }));
      return;
    }

    case 'video.asset.track.errored': {
      if (data.type !== 'text' || data.text_source !== 'generated_vod') return;
      const video = await videoByColumn('mux_asset_id', data.asset_id);
      if (video) await must(db.rpc('video_set_captions', { p_video_id: video.id, p_segments: [] }));
      return;
    }

    default:
      return; // events we do not use are acknowledged and ignored
  }
}
