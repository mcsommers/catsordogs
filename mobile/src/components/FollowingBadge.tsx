import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

/** Orange "Following" pill next to name/age on feed, profile, and 06k. */
export function FollowingBadge() {
  return (
    <View style={styles.tag} accessibilityLabel="Following">
      <Text style={styles.label}>Following</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: colors.accentDog,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.white },
});
