import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { colors, fonts } from '../../theme';
import { nudgeCardBody, nudgeCardTitle } from './socialCopy';

type Props = {
  firstName: string;
  gender?: string | null;
  alreadyNudged: boolean;
  onNudge: () => void;
};

/** 06n — shown when get_follow_state.can_nudge is true. */
export function NudgeCard({ firstName, gender, alreadyNudged, onNudge }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Bell size={18} color={colors.accentDog} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{nudgeCardTitle(firstName)}</Text>
        <Text style={styles.body}>{nudgeCardBody(gender)}</Text>
      </View>
      <Pressable
        style={[styles.btn, alreadyNudged && styles.btnDisabled]}
        onPress={onNudge}
        disabled={alreadyNudged}
        accessibilityRole="button"
      >
        <Text style={styles.btnLabel}>{alreadyNudged ? 'Nudged today' : `Nudge ${firstName}`}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentDogTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { gap: 4 },
  title: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  body: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textDarkMuted },
  btn: {
    backgroundColor: colors.accentDog,
    borderRadius: 9999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
});
