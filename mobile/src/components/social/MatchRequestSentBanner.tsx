import { StyleSheet, Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { colors, fonts } from '../../theme';

/** 06z — brief success state after sending a match from profile. */
export function MatchRequestSentBanner({ firstName }: { firstName: string }) {
  return (
    <View style={styles.banner}>
      <Heart size={16} color={colors.accentDog} fill={colors.accentDog} />
      <Text style={styles.text}>Match request sent to {firstName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentDogTint,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  text: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.white, flex: 1 },
});
