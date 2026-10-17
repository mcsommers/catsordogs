import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown,
  EllipsisVertical,
  Flame,
  Heart,
  MapPin,
  Quote,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
/** Chrome for one feed page; parent is a paging FlatList row — docs/mobile-feed-scroll.md */
import type { FeedItem } from '../lib/feed';
import { formatProfileLocation, formatStreakBadge, questionPillLabel } from '../lib/format';
import { FollowingBadge } from './FollowingBadge';
import { colors, fonts } from '../theme';

/** Space above the tab pill; Android needs extra room for 3-button system nav + tab padding. */
const BOTTOM_CHROME_OFFSET = Platform.OS === 'android' ? 150 : 100;

type Props = {
  item: FeedItem;
  muted: boolean;
  onToggleMute: () => void;
  onOpenProfile: () => void;
  onBrowse: () => void;
  onFeedSettings: () => void;
  onMoreOptions: () => void;
  onHeart: () => void;
  /** 0–1 progress through the current video playback. */
  videoProgress: number;
};

export function FeedOverlay({
  item,
  muted,
  onToggleMute,
  onOpenProfile,
  onBrowse,
  onFeedSettings,
  onMoreOptions,
  onHeart,
  videoProgress,
}: Props) {
  const insets = useSafeAreaInsets();
  const heartOn = item.matchState === 'sent' || item.matchState === 'matched';
  const streak = formatStreakBadge(item.streakDays);
  const distance = formatProfileLocation(item.city, item.distanceMiles);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false}>
      <LinearGradient colors={['#000000B3', '#00000000']} style={styles.topScrim} pointerEvents="none" />
      <LinearGradient colors={['#00000000', '#000000D9']} style={styles.bottomScrim} pointerEvents="none" />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none" collapsable={false}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, videoProgress * 100))}%` }]} />
        </View>
        <View style={styles.questionRow}>
          <Pressable
            style={styles.questionPill}
            onPress={onBrowse}
            accessibilityRole="button"
            accessibilityLabel="Browse questions"
          >
            <Quote size={13} color="#FFFFFFCC" style={styles.pillQuote} />
            <Text style={styles.pillText}>{questionPillLabel(item.questionDate, item.questionText)}</Text>
            <ChevronDown size={15} color="#FFFFFFB3" style={styles.pillChevron} />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable style={styles.iconBtn} onPress={onFeedSettings} accessibilityLabel="Feed settings" hitSlop={8}>
              <SlidersHorizontal size={15} color={colors.white} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={[styles.bottom, { bottom: BOTTOM_CHROME_OFFSET }]} pointerEvents="box-none" collapsable={false}>
        <View style={styles.captionBox} pointerEvents="none">
          <Text style={styles.caption}>{item.captionText || 'No captions for this answer.'}</Text>
        </View>
        <Pressable style={styles.infoCol} onPress={onOpenProfile} accessibilityRole="button">
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.firstName}, {item.age}</Text>
            {item.isFollowed ? <FollowingBadge /> : null}
          </View>
          {distance ? (
            <View style={styles.metaRow}>
              <MapPin size={13} color="#FFFFFFB3" />
              <Text style={styles.meta}>{distance}</Text>
            </View>
          ) : null}
        </Pressable>
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
            <Pressable
              style={[styles.actionBtn, heartOn && { backgroundColor: colors.accentDog }]}
              onPress={onHeart}
              accessibilityLabel="Match"
            >
              <Heart size={22} color={colors.white} fill={heartOn ? colors.white : 'transparent'} />
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={onToggleMute} accessibilityLabel={muted ? 'Unmute' : 'Mute'}>
              {muted ? <VolumeX size={22} color={colors.white} /> : <Volume2 size={22} color={colors.white} />}
            </Pressable>
          </View>
        </View>
      </View>
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
  pillText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, color: '#FFFFFFE6' },
  pillChevron: { marginTop: 2 },
  topActions: { gap: 8, alignItems: 'center' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 20, gap: 14 },
  captionBox: { backgroundColor: '#00000080', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.white },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoCol: { gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontFamily: fonts.heading, fontSize: 22, color: colors.white },
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
});
