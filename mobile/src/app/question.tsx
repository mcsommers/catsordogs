import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from 'expo-camera';
import Svg, { Circle } from 'react-native-svg';
import { RefreshCw, Timer, TriangleAlert } from 'lucide-react-native';
import {
  getGate,
  getQuestionToAnswer,
  getRecordingLengthSeconds,
  startUpload,
  uploadRecording,
  type Gate,
  type StartedUpload,
} from '../lib/api';
import { setCurrentRecording } from '../lib/currentRecording';
import { timerLabel } from '../lib/format';
import { CenteredSpinner, Dialog, PrimaryButton, QuestionBadge, Screen } from '../components/ui';
import { useSession } from '../lib/session';
import { colors, fonts } from '../theme';

type Phase = 'ready' | 'starting' | 'countdown' | 'recording' | 'finishing';

const COUNTDOWN_FROM = 3;
const RING = 84;
const STROKE = 4;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function TodaysQuestion() {
  const { session, loading: sessionLoading } = useSession();
  const camera = useRef<CameraView>(null);
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<CameraType>('front');

  const [question, setQuestion] = useState<string | null>(null);
  const [lengthSeconds, setLengthSeconds] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);

  const [attempt, setAttempt] = useState(0);
  const [gate, setGate] = useState<Gate | null>(null);

  const loadScreen = useCallback(async () => {
    if (sessionLoading || !session) return;
    setLoadFailed(false);
    setGate(null);
    setQuestion(null);
    setLengthSeconds(null);
    try {
      const g = await getGate();
      setGate(g);
      if (g.state !== 'not_answered') return;
      const [q, len] = await Promise.all([getQuestionToAnswer(), getRecordingLengthSeconds()]);
      if (!q) {
        setGate({ ...g, state: 'open' });
        return;
      }
      setQuestion(q.text);
      setLengthSeconds(len);
    } catch {
      setLoadFailed(true);
    }
  }, [session, sessionLoading]);

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [loadScreen])
  );

  useEffect(() => {
    if (attempt === 0) return;
    loadScreen();
  }, [attempt, loadScreen]);

  const ensurePermissions = useCallback(async (): Promise<boolean> => {
    const cam = cameraPermission?.granted ? cameraPermission : await requestCamera();
    const mic = micPermission?.granted ? micPermission : await requestMic();
    if (cam.granted && mic.granted) return true;
    setMessage('Cats or Dogs? needs your camera and microphone to record your answer. You can allow them in Settings.');
    return false;
  }, [cameraPermission, micPermission, requestCamera, requestMic]);

  // Ask on arrival (TestFlight and Expo Go), not only when the record button is tapped.
  useEffect(() => {
    if (!question || !lengthSeconds) return;
    void ensurePermissions();
  }, [question, lengthSeconds, ensurePermissions]);

  useEffect(() => {
    setCameraReady(false);
  }, [cameraPermission?.granted, micPermission?.granted, facing]);

  async function onRecordPress() {
    if (phase === 'recording') {
      camera.current?.stopRecording();
      return;
    }
    if (phase !== 'ready' || !lengthSeconds) return;
    setMessage(null);
    if (!(await ensurePermissions())) return;
    if (!cameraReady) return setMessage('The camera is still starting. Try again in a second.');

    setPhase('starting');
    try {
      const started = await startUpload();
      if (!started.ok) {
        setPhase('ready');
        const r = started.refusal;
        if (r.kind === 'daily_limit') return setLimit(r.limit);
        if (r.kind === 'no_question_today' || r.kind === 'already_answered') return router.replace('/feed');
        if (r.kind === 'profile_incomplete') return router.replace('/build-profile');
        return setMessage(r.message);
      }
      runCountdown(started.upload);
    } catch {
      setPhase('ready');
      setMessage('We couldn\u2019t start the recording. Please try again.');
    }
  }

  function runCountdown(upload: StartedUpload) {
    setPhase('countdown');
    setCount(COUNTDOWN_FROM);
    let n = COUNTDOWN_FROM;
    const tick = setInterval(() => {
      n -= 1;
      if (n > 0) return setCount(n);
      clearInterval(tick);
      record(upload);
    }, 1000);
  }

  async function record(upload: StartedUpload) {
    setPhase('recording');
    setElapsed(0);
    const startedAt = Date.now();
    const clock = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 100);
    try {
      const video = await camera.current?.recordAsync({ maxDuration: upload.recordingLengthSeconds });
      clearInterval(clock);
      if (!video?.uri) throw new Error('no file');
      setPhase('finishing');
      setCurrentRecording({
        videoId: upload.videoId,
        uploadUrl: upload.uploadUrl,
        fileUri: video.uri,
        flipPlayback: Platform.OS === 'android' && facing === 'front',
        upload: uploadRecording(upload.uploadUrl, video.uri).catch(() => false),
      });
      router.replace('/review');
    } catch {
      clearInterval(clock);
      setPhase('ready');
      setMessage('The recording didn\u2019t save. Please try again.');
    }
  }

  if (sessionLoading || !session || !gate) return <CenteredSpinner dark />;

  if (gate.state === 'open' || gate.state === 'no_question_today') return <Redirect href="/feed" />;
  if (gate.state === 'profile_incomplete') return <Redirect href="/build-profile" />;

  if (loadFailed) {
    return (
      <Screen dark>
        <View style={[styles.flex, { justifyContent: 'center', gap: 20 }]}>
          <Text style={styles.subtext}>We couldn&apos;t load today&apos;s question. Check your connection and try again.</Text>
          <PrimaryButton label="Try Again" onPress={() => setAttempt((n) => n + 1)} />
        </View>
      </Screen>
    );
  }
  if (!question || !lengthSeconds) return <CenteredSpinner dark />;

  const busy = phase === 'starting' || phase === 'countdown' || phase === 'finishing';
  const showFlipCamera = phase === 'ready' || phase === 'countdown';
  const hint =
    phase === 'countdown' ? 'Get ready…' : phase === 'recording' ? 'Tap to stop' : phase === 'starting' ? 'Starting…' : 'Tap to start recording';
  const progress = phase === 'recording' ? Math.min(elapsed / lengthSeconds, 1) : 0;
  const permissionBlocked = (cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain) ||
    (micPermission && !micPermission.granted && !micPermission.canAskAgain);

  return (
    <Screen dark>
      <View style={styles.column}>
        <View style={styles.intro}>
        <QuestionBadge />
        <Text style={styles.question}>{question}</Text>
        <Text style={styles.subtext}>Everyone answers before anyone can see today&apos;s responses.</Text>
      </View>

      <View style={styles.preview}>
        {cameraPermission?.granted && micPermission?.granted ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="video"
            onCameraReady={() => setCameraReady(true)}
          />
        ) : (
          <Text style={styles.previewPlaceholder}>
            {permissionBlocked
              ? 'Camera and microphone are off for this app. Turn them on in Settings to record.'
              : 'Allow camera and microphone when your phone asks, then your preview will appear here.'}
          </Text>
        )}
        {cameraPermission?.granted && micPermission?.granted ? (
          <View style={styles.faceGuide} pointerEvents="none" />
        ) : null}
        {phase === 'countdown' ? (
          <Text style={styles.countdown} accessibilityLiveRegion="assertive">
            {count}
          </Text>
        ) : null}
        {showFlipCamera ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
            onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            style={styles.flip}
            hitSlop={6}
          >
            <RefreshCw size={18} color={colors.white} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.record}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={phase === 'recording' ? 'Stop recording' : 'Start recording'}
          onPress={onRecordPress}
          disabled={busy}
          style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}
        >
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke={colors.borderDark} strokeWidth={STROKE} fill="none" />
            {phase === 'recording' ? (
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={RADIUS}
                stroke={colors.accentDog}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            ) : null}
          </Svg>
          <View style={[styles.capture, phase === 'recording' && styles.stop, busy && { opacity: 0.6 }]} />
        </Pressable>
        <Text style={styles.timer}>{timerLabel(phase === 'recording' ? elapsed : 0, lengthSeconds)}</Text>
        <Text style={styles.hint}>{hint}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {permissionBlocked ? (
          <Pressable onPress={() => Linking.openSettings()} hitSlop={8}>
            <Text style={styles.skip}>Open Settings</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setSkipOpen(true)}
        disabled={phase !== 'ready'}
        style={styles.skipHit}
        hitSlop={10}
      >
        <Text style={styles.skip}>Skip today&apos;s question</Text>
      </Pressable>
      </View>

      <Dialog
        visible={skipOpen}
        hero={{ type: 'icon', icon: TriangleAlert, iconTone: 'warning' }}
        title="Skip today's question?"
        body="You won't be able to see today's responses in the feed until you answer. Your matches and chats stay available."
        primary={{ label: 'Return to Question', onPress: () => setSkipOpen(false) }}
        secondary={{
          label: 'Skip Anyway',
          onPress: () => {
            setSkipOpen(false);
            router.replace('/feed');
          },
        }}
      />
      <Dialog
        visible={limit !== null}
        hero={{ type: 'icon', icon: Timer, iconTone: 'warning' }}
        title="Recording limit reached"
        body={`You've used all ${limit ?? ''} of today's recordings. The limit resets with tomorrow's question. Your matches and chats stay available.`}
        primary={{ label: 'Got It', onPress: () => setLimit(null) }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { flex: 1, minHeight: 0, gap: 28 },
  intro: { gap: 12, alignItems: 'center', flexShrink: 0 },
  question: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: colors.white, textAlign: 'center' },
  subtext: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textDarkMuted, textAlign: 'center' },
  preview: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    maxHeight: 380,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.borderDark,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholder: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textDarkMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
    maxWidth: 280,
  },
  faceGuide: { width: 170, height: 220, borderRadius: 110, borderWidth: 2, borderColor: '#FFFFFF33' },
  countdown: { position: 'absolute', fontFamily: fonts.heading, fontSize: 120, color: colors.white },
  flip: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
  },
  record: { alignItems: 'center', gap: 10, flexShrink: 0 },
  capture: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accentDog },
  stop: { width: 28, height: 28, borderRadius: 6 },
  timer: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.white },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textDarkMuted },
  message: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, color: '#FF5C5C', textAlign: 'center' },
  skipHit: { alignItems: 'center', flexShrink: 0, marginTop: 'auto' },
  skip: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textDarkMuted },
});
