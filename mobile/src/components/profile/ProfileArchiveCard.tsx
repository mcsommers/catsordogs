import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Play } from 'lucide-react-native';
import { formatAnswerMeta } from '../../lib/format';
import { useAnswerThumbnail } from '../../lib/useAnswerThumbnail';
import { colors, fonts } from '../../theme';
import { profileType } from './profileTypography';
import type { ProfileAnswer } from '../../lib/profile';

type Props = {
  answer: ProfileAnswer;
  onPress: () => void;
};

/** 06j / 08a archive row (surface-dark card). */
export function ProfileArchiveCard({ answer, onPress }: Props) {
  const disabled = answer.status !== 'live';
  const thumbnailUrl = useAnswerThumbnail(answer.answerId, answer.status);

  return (
    <Pressable
      style={[styles.card, disabled && styles.cardDisabled]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.thumb}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbImage} resizeMode="cover" />
        ) : null}
        <View style={styles.playOverlay}>
          <Play size={11} color={colors.white} />
        </View>
        {disabled ? (
          <View style={styles.hiddenBadge}>
            <Text style={styles.hiddenText}>Hidden</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.textCol}>
        <Text style={styles.question} numberOfLines={2}>{answer.questionText}</Text>
        <Text style={styles.meta}>{formatAnswerMeta(answer.questionDate, answer.durationSeconds)}</Text>
      </View>
      <ChevronRight size={15} color={colors.textDarkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceDark,
    borderRadius: 12,
    padding: 12,
    minHeight: 88,
  },
  cardDisabled: { opacity: 0.65 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.borderDark,
    overflow: 'hidden',
  },
  thumbImage: StyleSheet.absoluteFill,
  playOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#00000040',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: '#000000A6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
  },
  hiddenText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.white },
  textCol: { flex: 1, gap: 4 },
  question: profileType.archiveQuestion,
  meta: profileType.archiveMeta,
});
