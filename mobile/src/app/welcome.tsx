import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { PrimaryButton, Screen, TextLink, styles as ui } from '../components/ui';
import { safePause, safePlay } from '../lib/videoPlayer';
import { colors, fonts } from '../theme';

const welcomeVideo = require('../../assets/welcome-video-2b.mp4');

export default function Welcome() {
  const player = useVideoPlayer(welcomeVideo, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useFocusEffect(
    useCallback(() => {
      safePlay(player);
      return () => safePause(player);
    }, [player]),
  );

  return (
    <Screen scroll>
      <View style={{ gap: 20, alignItems: 'center' }}>
        <View style={styles.hero}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            pointerEvents="none"
          />
        </View>
        <Text style={styles.headline}>Cats or Dogs?</Text>
        <Text style={[ui.subtitle, { textAlign: 'center' }]}>
          Every day, everyone answers the same question on camera. Meet people through what they actually say, not how
          well they curate a profile.
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
  hero: {
    alignSelf: 'stretch',
    height: 300,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  headline: { fontFamily: fonts.heading, fontSize: 40, color: colors.textPrimary, textAlign: 'center' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  prompt: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
});
