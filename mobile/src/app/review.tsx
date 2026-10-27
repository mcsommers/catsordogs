import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Check, Clock3, Pencil, Play, RotateCcw, X } from 'lucide-react-native';
import { abandonPendingCaptions, getVideo, submitAnswer } from '../lib/api';
import { getCurrentRecording, setCurrentRecording } from '../lib/currentRecording';
import { clock } from '../lib/format';
import { CAPTION_FALLBACK_TEXT, CAPTION_WAIT_MS, reviewState, type VideoRow } from '../lib/recording';
import { Dialog, PrimaryButton } from '../components/ui';
import { colors, fonts } from '../theme';

const POLL_MS = 2000;

export default function ReviewAndSubmit() {
  const recording = getCurrentRecording();
  const insets = useSafeAreaInsets();
  const [row, setRow] = useState<VideoRow | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [captionWaitStopped, setCaptionWaitStopped] = useState(false);

  const player = useVideoPlayer(recording?.fileUri ?? null, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (!recording) router.replace('/question');
  }, [recording]);

  useEffect(() => {
    recording?.upload?.then((ok) => !ok && setUploadFailed(true));
  }, [recording]);

  const refresh = useCallback(async () => {
    if (!recording) return;
    try {
      setRow(await getVideo(recording.videoId));
    } catch {
      // keep polling; a brief network drop shouldn't end the review
    }
  }, [recording]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );
  const state = reviewState(row, uploadFailed, { captionWaitTimedOut: captionWaitStopped });
  useEffect(() => {
    if (state.kind !== 'processing') return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [state.kind, refresh]);

  useEffect(() => {
    if (!recording) return;
    if (captionWaitStopped) return;
    if (row?.status !== 'ready' || row?.captions_status !== 'pending') return;
    const timer = setTimeout(() => {
      setCaptionWaitStopped(true);
      abandonPendingCaptions(recording.videoId)
        .then(() => refresh())
        .catch(() => {
          setMessage('We couldn\u2019t load captions. Try submitting again.');
        });
    }, CAPTION_WAIT_MS);
    return () => clearTimeout(timer);
  }, [recording, row?.status, row?.captions_status, captionWaitStopped, refresh]);

  function togglePlay() {
    if (player.playing) player.pause();
    else player.play();
    setPlaying(!player.playing);
  }

  async function submit() {
    if (!recording) return;
    setMessage(null);
    setSubmitting(true);
    try {
      if (row?.captions_status === 'pending') {
        await abandonPendingCaptions(recording.videoId);
      }
      await submitAnswer(recording.videoId);
      player.pause();
      setSubmitted(true);
    } catch (e) {
      setMessage((e as Error).message || 'We couldn\u2019t submit your answer. Please try again.');
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function leave(to: '/question' | '/feed') {
    player.pause();
    setCurrentRecording(null);
    router.replace(to);
  }

  if (!recording) return null;

  const canSubmit = state.kind === 'ready' || state.kind === 'no_speech';
  const canEditCaptions = state.kind === 'ready' && row?.captions_status === 'ready';
  const duration = row?.duration_seconds ?? null;

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, recording.flipPlayback && styles.flipPlayback]}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      </View>
      <LinearGradient colors={['#00000088', '#00000000']} style={styles.topScrim} pointerEvents="none" />
      <LinearGradient colors={['#00000000', '#000000CC']} style={styles.bottomScrim} pointerEvents="none" />

      <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'} onPress={togglePlay} style={styles.playArea}>
        {!playing ? (
          <View style={styles.play}>
            <Play size={26} color={colors.white} fill={colors.white} />
          </View>
        ) : null}
      </Pressable>

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => leave('/feed')} style={styles.round} hitSlop={8}>
          <X size={16} color={colors.white} />
        </Pressable>
        {duration ? (
          <View style={styles.pill}>
            <Clock3 size={12} color={colors.white} />
            <Text style={styles.pillText}>{clock(duration)}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={canEditCaptions ? 'Edit captions' : undefined}
          disabled={!canEditCaptions}
          onPress={() => {
            player.pause();
            // Replace (not push) so Review unmounts — Android cannot run two players on the same file.
            router.replace('/edit-captions');
          }}
          style={styles.captionBox}
        >
          <Text style={[styles.caption, state.kind !== 'ready' && { color: colors.textDarkMuted }]}>
            {captionText(state)}
          </Text>
          {canEditCaptions ? (
            <View style={styles.editIcon}>
              <Pencil size={14} color={colors.white} />
            </View>
          ) : state.kind === 'processing' ? (
            <View style={styles.editIcon}>
              <ActivityIndicator size="small" color={colors.white} />
            </View>
          ) : null}
        </Pressable>
        <Text style={styles.helper}>{helperText(state)}</Text>
        {message ? <Text style={styles.error}>{message}</Text> : null}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => leave('/question')} style={styles.rerecord}>
            <RotateCcw size={16} color={colors.white} />
            <Text style={styles.rerecordLabel}>Re-record</Text>
          </Pressable>
          <PrimaryButton label="Submit" onPress={submit} disabled={!canSubmit} loading={submitting} style={{ flex: 1 }} />
        </View>
      </View>

      <Dialog
        visible={submitted}
        hero={{ type: 'icon', icon: Check, iconTone: 'success' }}
        title="Answer Submitted!"
        body="Your response is live. You can now see what everyone else said today."
        primary={{ label: "View Today's Feed", onPress: () => leave('/feed') }}
      />
    </View>
  );
}

function captionText(state: ReturnType<typeof reviewState>): string {
  switch (state.kind) {
    case 'ready':
      return state.caption || 'No caption text. Tap to add some.';
    case 'processing':
      return 'Making captions from your audio\u2026';
    case 'no_speech':
      return 'No speech found, so this video has no captions.';
    case 'too_long':
      return 'This recording is longer than today\u2019s limit, so it can\u2019t be used.';
    case 'failed':
      return 'This recording didn\u2019t upload.';
  }
}

function helperText(state: ReturnType<typeof reviewState>): string {
  switch (state.kind) {
    case 'ready':
      return state.caption === CAPTION_FALLBACK_TEXT
        ? 'Tap to edit your caption before you submit.'
        : 'Auto-captioned from your audio \u2014 tap to edit';
    case 'processing':
      return 'This usually takes a few seconds. After 8 seconds you can type your own caption.';
    case 'no_speech':
      return 'You can still submit it, or re-record.';
    case 'too_long':
    case 'failed':
      return 'Please re-record your answer.';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDark },
  flipPlayback: { transform: [{ scaleX: -1 }] },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 384 },
  playArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00000066', borderRadius: 9999, paddingVertical: 6, paddingHorizontal: 10 },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.white },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, gap: 10 },
  captionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1A1CB3',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFFFFF1F',
    padding: 14,
  },
  caption: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20, color: colors.white },
  editIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF26', alignItems: 'center', justifyContent: 'center' },
  helper: { fontFamily: fonts.body, fontSize: 11, color: colors.textDarkMuted },
  error: { fontFamily: fonts.bodySemi, fontSize: 13, color: '#FF5C5C' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  rerecord: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: '#FFFFFF4D',
    backgroundColor: '#00000066',
    minHeight: 54,
  },
  rerecordLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
});
