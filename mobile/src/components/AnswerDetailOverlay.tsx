import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EllipsisVertical, Flame, Heart, MapPin, Quote, Volume2, VolumeX } from 'lucide-react-native';
import type { ProfileAnswer } from '../lib/profile';
import { formatProfileLocation, formatStreakBadge, questionPillLabel } from '../lib/format';
import { FollowingBadge } from './FollowingBadge';
import { BackButton } from './ui';
import { colors, fonts } from '../theme';

type Subject = {
  firstName: string;
  age: number | null;
  city: string | null;
  distanceMiles: number | null;
  streakDays: number | null;
};

type Props = {
  answer: ProfileAnswer;
  subject: Subject;
  muted: boolean;
  matchState?: string;
  onToggleMute: () => void;
  onBack: () => void;
  onMoreOptions: () => void;
  onHeart: () => void;
  /** Your own video (06ka): no match heart. */
  hideHeart?: boolean;
  isFollowed?: boolean;
  videoProgress: number;
  showProgress: boolean;
  playbackError: string | null;
};

/** 06k chrome inside one paging row — docs/mobile-feed-scroll.md */
export function AnswerDetailOverlay({
  answer,
  subject,
  muted,
  onToggleMute,
  onBack,
  onMoreOptions,
  onHeart,
  hideHeart = false,
  isFollowed = false,
  matchState = 'none',
  videoProgress,
  showProgress,
  playbackError,
}: Props) {
  const insets = useSafeAreaInsets();
  const heartOn = matchState === 'sent' || matchState === 'matched';
  const locationLine = formatProfileLocation(subject.city, subject.distanceMiles);
  const streak = formatStreakBadge(subject.streakDays ?? 0);
  const progress = showProgress ? Math.min(100, Math.max(0, videoProgress * 100)) : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false}>
      <LinearGradient colors={['#000000B3', '#00000000']} style={styles.topScrim} pointerEvents="none" />
      <LinearGradient colors={['#00000000', '#000000D9']} style={styles.bottomScrim} pointerEvents="none" />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none" collapsable={false}>
        <BackButton onPress={onBack} dark />
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.questionRow}>
          <View style={styles.questionPill} accessibilityLabel={questionPillLabel(answer.questionDate, answer.questionText)}>
            <Quote size={13} color="#FFFFFFCC" style={styles.pillQuote} />
            <Text style={styles.pillText}>{questionPillLabel(answer.questionDate, answer.questionText)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none" collapsable={false}>
        <View style={styles.captionBox} pointerEvents="none">
          <Text style={styles.caption}>{answer.captionText || 'No captions for this answer.'}</Text>
        </View>
        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {subject.firstName.trim().toUpperCase()}
              {subject.age != null && Number.isFinite(subject.age) ? `, ${subject.age}` : ''}
            </Text>
            {isFollowed && !hideHeart ? <FollowingBadge /> : null}
          </View>
          {locationLine ? (
            <View style={styles.metaRow}>
              <MapPin size={13} color="#FFFFFFB3" />
              <Text style={styles.meta}>{locationLine}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.infoRow}>
          {streak ? (
            <View style={styles.streak}>
              <Flame size={12} color={colors.accentDog} />
              <Text style={styles.streakText}>{streak}</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.rail}>
            <Pressable style={styles.actionBtn} onPress={onMoreOptions} accessibilityLabel="More options">
              <EllipsisVertical size={22} color={colors.white} />
            </Pressable>
            {hideHeart ? null : (
            <Pressable
              style={[styles.actionBtn, heartOn && { backgroundColor: colors.accentDog }]}
              onPress={onHeart}
              accessibilityLabel="Match"
            >
              <Heart size={22} color={colors.white} fill={heartOn ? colors.white : 'transparent'} />
            </Pressable>
            )}
            <Pressable
              style={styles.actionBtn}
              onPress={onToggleMute}
              accessibilityRole="button"
              accessibilityLabel={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX size={22} color={colors.white} /> : <Volume2 size={22} color={colors.white} />}
            </Pressable>
          </View>
        </View>
      </View>

      {playbackError ? (
        <View style={styles.gateBanner}>
          <Text style={styles.gateText}>{playbackError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 360 },
  top: { paddingHorizontal: 20, gap: 10 },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: '#FFFFFF2E', overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: colors.white, borderRadius: 2 },
  questionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  questionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#00000066',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pillQuote: { marginTop: 2 },
  pillText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: '#FFFFFFE6' },
  topActions: { gap: 8, alignItems: 'center' },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, gap: 14 },
  captionBox: { backgroundColor: '#00000080', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.white },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoCol: { gap: 6 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    overflow: 'visible',
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    color: colors.white,
    flexShrink: 0,
    includeFontPadding: false,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontFamily: fonts.body, fontSize: 13, color: '#FFFFFFB3' },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF1F',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  streakText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.white },
  rail: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateBanner: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '40%',
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: 16,
    borderRadius: 12,
  },
  gateText: { fontFamily: fonts.body, fontSize: 14, color: colors.white, textAlign: 'center', lineHeight: 20 },
});
