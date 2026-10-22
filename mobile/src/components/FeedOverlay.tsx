import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EllipsisVertical, Heart, Search, SlidersHorizontal } from 'lucide-react-native';
import { VideoProgressControls } from './VideoProgressControls';
/** Chrome for one feed page; parent is a paging FlatList row — docs/mobile-feed-scroll.md */
import type { FeedItem } from '../lib/feed';
import { formatFeedPosterCity, shortQuestionDate } from '../lib/format';
import { FollowingBadge } from './FollowingBadge';
import { ExpandableCaption } from './ExpandableCaption';
import { colors, fonts } from '../theme';

/** Space above the tab pill; Android needs extra room for 3-button system nav + tab padding. */
const BOTTOM_CHROME_OFFSET = Platform.OS === 'android' ? 150 : 100;

const AVATAR_ACTION_SIZE = 48;

type Props = {
  item: FeedItem;
  muted: boolean;
  onToggleMute: () => void;
  onOpenProfile: () => void;
  onBrowse: () => void;
  onSearchQuestions: () => void;
  onFeedSettings: () => void;
  onMoreOptions: () => void;
  onHeart: () => void;
  /** 0–1 progress through the current video playback. */
  videoProgress: number;
  isPlaying: boolean;
  onTogglePlayPause: () => void;
};

function QuestionPillLabel({ questionDate, questionText }: { questionDate: string; questionText: string }) {
  return (
    <Text style={styles.pillText}>
      <Text style={styles.pillDate}>{shortQuestionDate(questionDate)} · </Text>
      {questionText}
    </Text>
  );
}

export function FeedOverlay({
  item,
  muted,
  onToggleMute,
  onOpenProfile,
  onBrowse,
  onSearchQuestions,
  onFeedSettings,
  onMoreOptions,
  onHeart,
  videoProgress,
  isPlaying,
  onTogglePlayPause,
}: Props) {
  const insets = useSafeAreaInsets();
  const heartOn = item.matchState === 'sent' || item.matchState === 'matched';
  const city = formatFeedPosterCity(item.city);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false}>
      <LinearGradient colors={['#000000B3', '#00000000']} style={styles.topScrim} pointerEvents="none" />
      <LinearGradient colors={['#00000000', '#000000D9']} style={styles.bottomScrim} pointerEvents="none" />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none" collapsable={false}>
        <View style={styles.questionRow}>
          <Pressable
            style={styles.questionPill}
            onPress={onBrowse}
            accessibilityRole="button"
            accessibilityLabel="Browse questions"
          >
            <QuestionPillLabel questionDate={item.questionDate} questionText={item.questionText} />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable style={styles.iconBtn} onPress={onFeedSettings} accessibilityLabel="Feed settings" hitSlop={8}>
              <SlidersHorizontal size={15} color={colors.white} />
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              onPress={onSearchQuestions}
              accessibilityLabel="Search past questions"
              hitSlop={8}
            >
              <Search size={15} color={colors.white} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={[styles.bottom, { bottom: BOTTOM_CHROME_OFFSET }]} pointerEvents="box-none" collapsable={false}>
        <View style={styles.captionIdentityRow}>
          <View style={styles.identityCaptionCol}>
            <Pressable style={styles.identityBlock} onPress={onOpenProfile} accessibilityRole="button">
              <View style={styles.nameRow}>
                <View style={styles.nameIdentity}>
                  <Text style={styles.name}>{item.firstName}, {item.age}</Text>
                  {city ? <Text style={styles.city}>{city}</Text> : null}
                </View>
                {item.isFollowed ? (
                  <View style={styles.followingWrap}>
                    <FollowingBadge />
                  </View>
                ) : null}
              </View>
            </Pressable>
            <ExpandableCaption text={item.captionText ?? ''} resetKey={item.answerId} />
          </View>
          <View style={styles.actionStrip}>
            <Pressable
              style={styles.actionBtn}
              onPress={onOpenProfile}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.firstName}'s profile`}
            >
              {item.avatarUrl ? (
                <Image
                  source={{ uri: item.avatarUrl }}
                  style={styles.avatarImage}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={styles.avatarPlaceholder} />
              )}
            </Pressable>
            <Pressable
              style={[styles.actionBtn, heartOn && { backgroundColor: colors.accentDog }]}
              onPress={onHeart}
              accessibilityLabel="Match"
            >
              <Heart size={22} color={colors.white} fill={heartOn ? colors.white : 'transparent'} />
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={onMoreOptions} accessibilityLabel="More options">
              <EllipsisVertical size={22} color={colors.white} />
            </Pressable>
          </View>
        </View>
        <VideoProgressControls
          videoProgress={videoProgress}
          muted={muted}
          isPlaying={isPlaying}
          onTogglePlayPause={onTogglePlayPause}
          onToggleMute={onToggleMute}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 360 },
  top: { paddingHorizontal: 20, gap: 10 },
  questionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  questionPill: {
    flex: 1,
    backgroundColor: '#00000066',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, color: '#FFFFFFE6' },
  pillDate: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: colors.accentDog },
  topActions: { gap: 8, alignItems: 'center' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 20, gap: 16 },
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
  nameIdentity: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap' },
  name: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 26,
    color: colors.white,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  city: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 17,
    color: '#FFFFFFB3',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  followingWrap: { marginLeft: 4 },
  actionStrip: { gap: 14, alignItems: 'center' },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
