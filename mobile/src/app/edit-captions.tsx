import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ArrowLeft, Clock3, Play } from 'lucide-react-native';
import { getVideo, resetCaptions, saveCaptionTexts } from '../lib/api';
import { getCurrentRecording, type CurrentRecording } from '../lib/currentRecording';
import { clock } from '../lib/format';
import {
  joinedCaptionText,
  maxCaptionEditLength,
  splitCaptionForSegments,
  type CaptionSegment,
} from '../lib/recording';
import { AppTextInput, CenteredSpinner, FormScrollContext, PrimaryButton } from '../components/ui';
import { colors, fonts } from '../theme';

function leaveReview() {
  router.replace('/review');
}

type EditCaptionsFormProps = {
  recording: CurrentRecording;
  previewAboveCaptions: ReactNode;
};

function EditCaptionsForm({ recording, previewAboveCaptions }: EditCaptionsFormProps) {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const captionAnchorRef = useRef<View>(null);
  const [segments, setSegments] = useState<CaptionSegment[] | null>(null);
  const [text, setText] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const row = await getVideo(recording.videoId);
        const segs = Array.isArray(row?.caption_segments) ? row.caption_segments : [];
        setSegments(segs);
        setText(joinedCaptionText(segs));
        setDuration(row?.duration_seconds ?? null);
      } catch {
        setMessage('We couldn\u2019t load your captions. Go back and try again.');
      }
    })();
  }, [recording.videoId, version]);

  async function save() {
    if (!segments?.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const texts = splitCaptionForSegments(text, segments);
      if (texts.some((t) => t.length > 500)) {
        setMessage('Each part of the caption can be up to 500 characters. Try shortening it.');
        return;
      }
      await saveCaptionTexts(recording.videoId, texts);
      leaveReview();
    } catch (e) {
      setMessage((e as Error).message || 'We couldn\u2019t save your captions. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setMessage(null);
    try {
      await resetCaptions(recording.videoId);
      setVersion((v) => v + 1);
    } catch (e) {
      setMessage((e as Error).message || 'We couldn\u2019t reset your captions.');
    }
  }

  if (!segments) return <CenteredSpinner dark />;

  const maxLen = maxCaptionEditLength(segments.length);

  const durationBanner =
    !previewAboveCaptions && duration ? (
      <View style={styles.durationOnly}>
        <Clock3 size={14} color={colors.textDarkMuted} />
        <Text style={styles.durationLabel}>{clock(duration)} recording — preview on Review</Text>
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => leaveReview()} style={styles.round} hitSlop={8}>
          <ArrowLeft size={16} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>Edit Captions</Text>
        <View style={styles.headerSpacer} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FormScrollContext.Provider value={{ scrollRef, contentRef }}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View ref={contentRef} collapsable={false}>
              {previewAboveCaptions ?? durationBanner}

              <View ref={captionAnchorRef} collapsable={false} style={styles.sectionHeader}>
                <Text style={styles.section}>Caption</Text>
                <Pressable accessibilityRole="button" onPress={reset} hitSlop={8}>
                  <Text style={styles.reset}>Reset to auto</Text>
                </Pressable>
              </View>

              <AppTextInput
                accessibilityLabel="Caption"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={maxLen}
                placeholder="Your caption"
                placeholderTextColor={colors.textDarkFaint}
                focusScrollAnchorRef={captionAnchorRef}
                style={styles.box}
                textAlignVertical="top"
              />

              <Text style={styles.tip}>Tip: keep it short and true to what you said.</Text>
              {message ? <Text style={styles.error}>{message}</Text> : null}
              <PrimaryButton label="Save Captions" onPress={save} loading={busy} />
            </View>
          </ScrollView>
        </FormScrollContext.Provider>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EditCaptionsWithPreview({ recording }: { recording: CurrentRecording }) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const player = useVideoPlayer(recording.fileUri, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    (async () => {
      try {
        const row = await getVideo(recording.videoId);
        setDuration(row?.duration_seconds ?? null);
      } catch {
        // preview still works; duration pill is optional
      }
    })();
  }, [recording.videoId]);

  useEffect(() => () => {
    try {
      player.pause();
    } catch {
      // player may already be released on unmount
    }
  }, [player]);

  function togglePlay() {
    if (player.playing) player.pause();
    else player.play();
    setPlaying(!player.playing);
  }

  const preview = (
    <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'} onPress={togglePlay} style={styles.preview}>
      <View style={[StyleSheet.absoluteFill, recording.flipPlayback && styles.flipPlayback]}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      </View>
      {!playing ? (
        <View style={styles.play}>
          <Play size={22} color={colors.white} fill={colors.white} />
        </View>
      ) : null}
      {duration ? (
        <View style={styles.pill}>
          <Clock3 size={11} color={colors.white} />
          <Text style={styles.pillText}>{clock(duration)}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return <EditCaptionsForm recording={recording} previewAboveCaptions={preview} />;
}

export default function EditCaptions() {
  const recording = getCurrentRecording();

  useEffect(() => {
    if (!recording) leaveReview();
  }, [recording]);

  if (!recording) return null;

  if (Platform.OS === 'android') {
    return <EditCaptionsForm recording={recording} previewAboveCaptions={null} />;
  }

  return <EditCaptionsWithPreview recording={recording} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 7 },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceDark, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.heading, fontSize: 20, color: colors.white },
  headerSpacer: { width: 36, height: 36 },
  content: { padding: 20, gap: 20 },
  preview: { height: 200, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surfaceDark, alignItems: 'center', justifyContent: 'center' },
  durationOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  durationLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textDarkMuted },
  flipPlayback: { transform: [{ scaleX: -1 }] },
  play: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#00000066',
    borderRadius: 9999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.white },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontFamily: fonts.heading, fontSize: 20, color: colors.white },
  reset: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textDarkMuted },
  box: {
    minHeight: 140,
    backgroundColor: colors.surfaceDark,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
  tip: { fontFamily: fonts.body, fontSize: 12, color: colors.textDarkFaint },
  error: { fontFamily: fonts.bodySemi, fontSize: 13, color: '#FF5C5C' },
});
