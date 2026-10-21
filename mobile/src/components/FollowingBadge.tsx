import { StyleSheet, View } from 'react-native';
import { UserCheck } from 'lucide-react-native';
import { colors } from '../theme';

const SIZE = 20;
const ICON_SIZE = 12;

/** Orange circle with user-check icon (Pencil **Following Badge** `vveCW`). */
export function FollowingBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Following">
      <UserCheck size={ICON_SIZE} color={colors.white} strokeWidth={2.25} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.accentDog,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
