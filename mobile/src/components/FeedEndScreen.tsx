import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { PrimaryButton, styles as ui } from './ui';
import { colors, fonts } from '../theme';

type Props = {
  lookbackDays: number;
  onBrowse: () => void;
  onFeedSettings: () => void;
};

export function FeedEndScreen({ lookbackDays, onBrowse, onFeedSettings }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Check size={34} color={colors.accentDog} />
      </View>
      <Text style={styles.title}>You&apos;re all caught up</Text>
      <Text style={styles.body}>
        You&apos;ve seen every answer from the last {lookbackDays} days that matches your filters. Check back tomorrow, or adjust your Feed Settings to see more people.
      </Text>
      <PrimaryButton label="Browse Past Questions" onPress={onBrowse} style={{ alignSelf: 'stretch' }} />
      <Pressable style={[ui.primary, styles.outline, { alignSelf: 'stretch' }]} onPress={onFeedSettings} accessibilityRole="button">
        <Text style={styles.outlineLabel}>Adjust Feed Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
    backgroundColor: colors.bgDark,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.heading, fontSize: 26, color: colors.white, textAlign: 'center' },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textDarkMuted,
    textAlign: 'center',
  },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#FFFFFF33' },
  outlineLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white, textAlign: 'center' },
});
