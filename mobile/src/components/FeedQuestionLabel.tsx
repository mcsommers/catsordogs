import { Platform, StyleSheet, Text } from 'react-native';
import { shortQuestionDate } from '../lib/format';
import { colors, fonts } from '../theme';

type Props = {
  questionDate: string;
  questionText: string;
};

/** One wrapping line: orange date · then question (06, 06k). Matches docs/pencil-new.pen 06 Feed. */
export function FeedQuestionLabel({ questionDate, questionText }: Props) {
  return (
    <Text style={styles.questionText}>
      <Text style={styles.questionDate}>{shortQuestionDate(questionDate)} · </Text>
      {questionText}
    </Text>
  );
}

const styles = StyleSheet.create({
  questionText: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 26,
    color: colors.white,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  questionDate: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 26,
    color: colors.accentDog,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
});
