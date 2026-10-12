import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Eye, Play } from 'lucide-react-native';
import { useAnswerThumbnail } from '../../lib/useAnswerThumbnail';
import { colors, fonts } from '../../theme';
import type { ProfileAnswer } from '../../lib/profile';

type Props = {
  answer: ProfileAnswer;
  onPress: () => void;
  width: number;
};

/** 08 Your Answers horizontal preview thumb with view count. */
export function ProfileAnswerPreviewThumb({ answer, onPress, width }: Props) {
  const disabled = answer.status !== 'live';
  const thumbnailUrl = useAnswerThumbnail(answer.answerId, answer.status);
  return (
    <Pressable
      style={[styles.thumb, { width }, disabled && styles.disabled]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.thumbImage} resizeMode="cover" />
      ) : null}
      <View style={styles.play}>
        <Play size={11} color={colors.white} />
      </View>
      {answer.viewCount != null ? (
        <View style={styles.views}>
          <Eye size={10} color={colors.white} />
          <Text style={styles.viewCount}>{answer.viewCount}</Text>
        </View>
      ) : null}
      {disabled ? (
        <View style={styles.hidden}>
          <Text style={styles.hiddenText}>Hidden</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumb: {
    height: 100,
    borderRadius: 10,
    backgroundColor: colors.surfaceDark,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbImage: StyleSheet.absoluteFill,
  disabled: { opacity: 0.6 },
  play: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00000080',
    alignItems: 'center',
    justifyContent: 'center',
  },
  views: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#000000A6',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  viewCount: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.white },
  hidden: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#000000A6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hiddenText: { fontFamily: fonts.bodySemi, fontSize: 9, color: colors.white },
});
