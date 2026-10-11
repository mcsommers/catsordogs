import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Hourglass, Lock } from 'lucide-react-native';
import { PrimaryButton, QuestionBadge } from './ui';
import { colors, fonts } from '../theme';

/** 04g: no question is scheduled for today. */
export function NoQuestionToday({ onCheckAgain, checking }: { onCheckAgain: () => void; checking?: boolean }) {
  return (
    <View style={styles.center}>
      <View style={styles.iconBadge}>
        <Hourglass size={30} color={colors.accentDog} />
      </View>
      <QuestionBadge />
      <Text style={styles.heading}>No question yet today</Text>
      <Text style={styles.body}>
        Today&apos;s question isn&apos;t ready yet. Check back soon. We&apos;ll send you a notification when it&apos;s live.
      </Text>
      <Pressable accessibilityRole="button" onPress={onCheckAgain} disabled={checking} hitSlop={10} style={{ marginTop: 12 }}>
        <Text style={styles.link}>{checking ? 'Checking…' : 'Check again'}</Text>
      </Pressable>
    </View>
  );
}

/** 06m: the Feed tab before today's answer is in. */
export function FeedLocked({ question, onAnswer }: { question: string; onAnswer: () => void }) {
  return (
    <View style={[styles.center, { paddingHorizontal: 12 }]}>
      <View style={[styles.iconBadge, { width: 84, height: 84, borderRadius: 42 }]}>
        <Lock size={34} color={colors.accentDog} />
      </View>
      <View style={{ gap: 10, alignItems: 'center' }}>
        <Text style={[styles.heading, { fontSize: 26 }]}>Today&apos;s feed is locked</Text>
        <Text style={styles.body}>
          Record your answer to today&apos;s question to unlock the feed and see what everyone else said. Your matches,
          chats and profile are still available.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>TODAY&apos;S QUESTION</Text>
        <Text style={styles.cardQuestion}>{question}</Text>
      </View>
      <PrimaryButton label="Answer Today's Question" onPress={onAnswer} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 20 },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontFamily: fonts.heading, fontSize: 28, color: colors.white, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textDarkMuted, textAlign: 'center' },
  link: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: 16,
    gap: 6,
    alignItems: 'center',
  },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, color: colors.accentDog },
  cardQuestion: { fontFamily: fonts.heading, fontSize: 18, color: colors.white, textAlign: 'center' },
});
