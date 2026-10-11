import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Cat, Dog, Heart } from 'lucide-react-native';
import { PrimaryButton, Screen, TextLink, styles as ui } from '../components/ui';
import { colors, fonts } from '../theme';

export default function Welcome() {
  return (
    <Screen scroll>
      <View style={{ gap: 20, alignItems: 'center' }}>
        <LinearGradient colors={[colors.accentCat, colors.accentDog]} style={styles.hero}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Cat size={30} color={colors.white} />
            </View>
            <Heart size={22} color={colors.white} />
            <View style={styles.badge}>
              <Dog size={30} color={colors.white} />
            </View>
          </View>
          <Text style={styles.heroTag}>PICK YOUR PACK</Text>
        </LinearGradient>
        <Text style={styles.headline}>Cats or Dogs?</Text>
        <Text style={[ui.subtitle, { textAlign: 'center' }]}>
          Every day, everyone answers the same question on camera. Answer today&apos;s, then meet people through what
          they actually say, not how well they curate a profile.
        </Text>
      </View>
      <View style={{ gap: 14, marginTop: 12 }}>
        <PrimaryButton label="Get Started" onPress={() => router.push('/sign-up')} />
        <View style={styles.loginRow}>
          <Text style={styles.prompt}>Already have an account?</Text>
          <TextLink label="Log In" color={colors.accentDog} size={14} onPress={() => router.push('/log-in')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignSelf: 'stretch', height: 300, borderRadius: 32, alignItems: 'center', justifyContent: 'center', gap: 20 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  badge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF33', alignItems: 'center', justifyContent: 'center' },
  heroTag: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 2, color: '#FFFFFFCC' },
  headline: { fontFamily: fonts.heading, fontSize: 40, color: colors.textPrimary, textAlign: 'center' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  prompt: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
});
