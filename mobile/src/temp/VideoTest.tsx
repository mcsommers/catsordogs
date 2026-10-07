// TEMPORARY plain screen for checking Phase 3 (recording upload, captions, playback).
// It is replaced by the designed screens (05 Record, 05b Edit Captions, ...) in Phase C.
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '../lib/supabase';

type VideoRow = {
  id: string;
  status: string;
  reject_reason: string | null;
  duration_seconds: number | null;
  captions_status: string;
  caption_segments: { start: number; end: number; text: string }[] | null;
};

async function errorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    const body = await context.json().catch(() => null);
    if (body?.error) return body.error;
  }
  return (error as Error).message;
}

function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });
  return <VideoView player={player} style={styles.video} nativeControls />;
}

export default function VideoTest() {
  const [message, setMessage] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [row, setRow] = useState<VideoRow | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  // While a video is being processed, check on it every few seconds.
  useEffect(() => {
    if (!videoId) return;
    let stop = false;
    const check = async () => {
      const { data } = await supabase
        .from('videos')
        .select('id, status, reject_reason, duration_seconds, captions_status, caption_segments')
        .eq('id', videoId)
        .maybeSingle();
      if (!stop && data) setRow(data as VideoRow);
    };
    check();
    const timer = setInterval(check, 3000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [videoId]);

  async function recordAndUpload(source: 'camera' | 'library') {
    setMessage('');
    setPlaybackUrl(null);
    const start = await supabase.functions.invoke('create-video-upload');
    if (start.error) return setMessage(await errorMessage(start.error));
    const { video_id, upload_url, recording_length_seconds } = start.data;

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['videos'],
      videoMaxDuration: recording_length_seconds,
    };
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return setMessage('Camera permission is needed.');
    }
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled) return setMessage('Cancelled before uploading. (That attempt still counts toward today\'s limit.)');

    setVideoId(video_id);
    setMessage('Uploading...');
    const blob = await (await fetch(picked.assets[0].uri)).blob();
    const put = await fetch(upload_url, { method: 'PUT', body: blob });
    setMessage(put.ok ? 'Uploaded. Mux is processing it...' : `Upload failed (${put.status}).`);
  }

  async function loadPlayback() {
    if (!videoId) return;
    const { data, error } = await supabase.functions.invoke('get-playback-url', { body: { video_id: videoId } });
    if (error) return setMessage(await errorMessage(error));
    setPlaybackUrl(data.playback_url);
  }

  async function editFirstCaption() {
    if (!row?.caption_segments?.length) return;
    const texts = row.caption_segments.map((s, i) => (i === 0 ? `${s.text} (edited)` : s.text));
    const { error } = await supabase.rpc('update_caption_segments', { p_video_id: row.id, p_texts: texts });
    setMessage(error ? error.message : 'First caption edited.');
  }

  async function resetCaptions() {
    if (!row) return;
    const { error } = await supabase.rpc('reset_captions', { p_video_id: row.id });
    setMessage(error ? error.message : 'Captions reset.');
  }

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>Phase 3: recording (temporary)</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Button title="Record today's answer" onPress={() => recordAndUpload('camera')} />
      <Button title="Pick a video from the library" onPress={() => recordAndUpload('library')} />
      {row ? (
        <View style={styles.block}>
          <Text>
            Status: {row.status}
            {row.reject_reason ? ` (${row.reject_reason})` : ''}  |  Length: {row.duration_seconds ?? '?'}s  |  Captions: {row.captions_status}
          </Text>
          {row.caption_segments?.map((s, i) => (
            <Text key={i}>
              {s.start.toFixed(1)}s: {s.text}
            </Text>
          ))}
          {row.status === 'ready' ? <Button title="Play my video" onPress={loadPlayback} /> : null}
          {row.captions_status === 'ready' ? <Button title="Edit first caption" onPress={editFirstCaption} /> : null}
          {row.captions_status === 'ready' ? <Button title="Reset captions" onPress={resetCaptions} /> : null}
        </View>
      ) : null}
      {playbackUrl ? <Player url={playbackUrl} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  heading: { fontSize: 16, fontWeight: '700' },
  message: { color: '#8B3FC7' },
  video: { width: '100%', height: 320, backgroundColor: '#000' },
});
