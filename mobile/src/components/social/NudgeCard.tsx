import { Pressable, Text, View } from 'react-native';
import { BellRing } from 'lucide-react-native';
import { colors } from '../../theme';
import { nudgeCardBody, nudgeCardTitle } from './socialCopy';
import { profileActionCardStyles as styles } from './profileActionCardStyles';

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
      <View style={styles.infoRow}>
        <View style={styles.iconWrap}>
          <BellRing size={20} color={colors.white} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{nudgeCardTitle(firstName)}</Text>
          <Text style={styles.body}>{nudgeCardBody(gender)}</Text>
        </View>
      </View>
      <Pressable
        style={[
          styles.actionBtn,
          styles.actionBtnFull,
          styles.actionBtnPrimary,
          alreadyNudged && styles.actionBtnDisabled,
        ]}
        onPress={onNudge}
        disabled={alreadyNudged}
        accessibilityRole="button"
      >
        <Text style={styles.actionBtnLabel}>{alreadyNudged ? 'Nudged today' : `Nudge ${firstName}`}</Text>
      </Pressable>
    </View>
  );
}
