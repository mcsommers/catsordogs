import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EllipsisVertical, Heart, MapPin, Volume2, VolumeX } from 'lucide-react-native';
import type { ProfileAnswer } from '../lib/profile';
import { formatProfileLocation, shortQuestionDate } from '../lib/format';
import { FollowingBadge } from './FollowingBadge';
import { ExpandableCaption } from './ExpandableCaption';
import { BackButton } from './ui';
import { colors, fonts } from '../theme';

const AVATAR_ACTION_SIZE = 48;

type Subject = {
  firstName: string;
  age: number | null;
  city: string | null;
  distanceMiles: number | null;
};

type Props = {
  answer: ProfileAnswer;
  subject: Subject;
  avatarUrl?: string | null;
  muted: boolean;
  matchState?: string;
  onToggleMute: () => void;
  onBack: () => void;
  onOpenProfile?: () => void;
  onMoreOptions: () => void;
  onHeart: () => void;
  /** Your own video (06ka): no match heart. */
  hideHeart?: boolean;
  isFollowed?: boolean;
  videoProgress: number;
  showProgress: boolean;
  playbackError: string | null;
};

function QuestionPillLabel({ questionDate, questionText }: { questionDate: string; questionText: string }) {
  return (
    <Text style={styles.pillText}>
      <Text style={styles.pillDate}>{shortQuestionDate(questionDate)} · </Text>
      {questionText}
    </Text>
  );
}

/** 06k chrome inside one paging row — docs/mobile-feed-scroll.md */
export function AnswerDetailOverlay({
  answer,
  subject,
  avatarUrl,
  muted,
  onToggleMute,
  onBack,
  onOpenProfile,
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
  const progress = showProgress ? Math.min(100, Math.max(0, videoProgress * 100)) : 0;
  const ageLabel =
    subject.age != null && Number.isFinite(subject.age) ? `, ${subject.age}` : '';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false}>
      <LinearGradient colors={['#000000B3', '#00000000']} style={styles.topScrim} pointerEvents="none" />
      <LinearGradient colors={['#00000000', '#000000D9']} style={styles.bottomScrim} pointerEvents="none" />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none" collapsable={false}>
        <BackButton onPress={onBack} dark />
        <View
          style={styles.questionPill}
          accessibilityLabel={`${shortQuestionDate(answer.questionDate)} · ${answer.questionText}`}
        >
          <QuestionPillLabel questionDate={answer.questionDate} questionText={answer.questionText} />
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none" collapsable={false}>
        <View style={styles.captionIdentityRow}>
          <View style={styles.identityCaptionCol}>
            <View style={styles.identityBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>
                  {subject.firstName.trim()}
                  {ageLabel}
                </Text>
                {isFollowed && !hideHeart ? (
                  <View style={styles.followingWrap}>
                    <FollowingBadge />
                  </View>
                ) : null}
              </View>
              {locationLine ? (
                <View style={styles.metaRow}>
                  <MapPin size={13} color="#FFFFFFB3" />
                  <Text style={styles.meta}>{locationLine}</Text>
                </View>
              ) : null}
            </View>
            <ExpandableCaption text={answer.captionText ?? ''} resetKey={answer.answerId} />
          </View>
          <View style={styles.actionStrip}>
            {onOpenProfile ? (
              <Pressable
                style={styles.actionBtn}
                onPress={onOpenProfile}
                accessibilityRole="button"
                accessibilityLabel={`Open ${subject.firstName.trim()}'s profile`}
              >
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatarImage}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={styles.avatarPlaceholder} />
                )}
              </Pressable>
            ) : null}
            {hideHeart ? null : (
              <Pressable
                style={[styles.actionBtn, heartOn && { backgroundColor: colors.accentDog }]}
                onPress={onHeart}
                accessibilityLabel="Match"
              >
                <Heart size={22} color={colors.white} fill={heartOn ? colors.white : 'transparent'} />
              </Pressable>
            )}
            <Pressable style={styles.actionBtn} onPress={onMoreOptions} accessibilityLabel="More options">
              <EllipsisVertical size={22} color={colors.white} />
            </Pressable>
          </View>
        </View>
        <View style={styles.progressMuteRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Pressable style={styles.actionBtn} onPress={onToggleMute} accessibilityLabel={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX size={22} color={colors.white} /> : <Volume2 size={22} color={colors.white} />}
          </Pressable>
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
  questionPill: {
    backgroundColor: '#00000066',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, color: '#FFFFFFE6' },
  pillDate: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: colors.accentDog },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, gap: 16 },
  captionIdentityRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  identityCaptionCol: { flex: 1, gap: 16 },
  identityBlock: { gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  avatarImage: { width: AVATAR_ACTION_SIZE, height: AVATAR_ACTION_SIZE, borderRadius: AVATAR_ACTION_SIZE / 2 },
  avatarPlaceholder: {
    width: AVATAR_ACTION_SIZE,
    height: AVATAR_ACTION_SIZE,
    borderRadius: AVATAR_ACTION_SIZE / 2,
    backgroundColor: '#FFFFFF33',
  },
  name: { fontFamily: fonts.heading, fontSize: 22, color: colors.white },
  followingWrap: { marginLeft: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: '#FFFFFFB3', flexShrink: 1 },
  actionStrip: { gap: 14, alignItems: 'center' },
  progressMuteRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF2E', overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: colors.white, borderRadius: 2 },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
