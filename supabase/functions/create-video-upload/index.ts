// Called by the app when the user taps record. Checks the rules (profile
// finished, a question exists today, daily limit), then asks Mux for a one-time
// upload link the app sends the video to.
import { corsHeaders, json } from '../_shared/http.ts';
import { muxClient, serviceClient, userClient } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const { data, error } = await userClient(req).rpc('request_video_upload');
  if (error) {
    // The database's own messages are written to be shown to the user.
    const status = error.code === '28000' ? 401 : error.code === '42501' ? 401 : 409;
    return json({ error: error.message }, status);
  }
  const { video_id, recording_length_seconds } = data[0];

  const server = serviceClient();
  try {
    const mux = muxClient();
    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      timeout: 3600,
      test: Deno.env.get('MUX_TEST_MODE') === 'true',
      new_asset_settings: {
        passthrough: video_id, // comes back on every asset event so we know whose video it is
        playback_policies: ['signed'], // nobody can watch without a short-lived token we issue
        video_quality: 'basic',
        inputs: [{ generated_subtitles: [{ language_code: 'en', name: 'English (generated)' }] }],
      },
    });
    const { error: attachError } = await server.rpc('video_attach_upload', {
      p_video_id: video_id,
      p_mux_upload_id: upload.id,
    });
    if (attachError) throw attachError;
    return json({ video_id, upload_url: upload.url, recording_length_seconds });
  } catch (e) {
    console.error('create-video-upload failed', e);
    await server.rpc('video_mark_failed', { p_video_id: video_id });
    return json({ error: 'We could not start the upload. Please try again.' }, 502);
  }
});
