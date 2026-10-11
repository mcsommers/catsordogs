import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays, Users, Video, type LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { getRecordingLengthSeconds } from '../lib/api';
import { PrimaryButton, Screen } from '../components/ui';
import { colors, fonts } from '../theme';

export default function HowItWorks() {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    getRecordingLengthSeconds().then(setSeconds).catch(() => setSeconds(null));
  }, []);

  const steps: { Icon: ComponentType<LucideProps>; title: string; body: string }[] = [
    { Icon: CalendarDays, title: 'Everyone gets the same question', body: 'A new one drops every day, for everyone.' },
    {
      Icon: Video,
      title: 'Answer on camera',
      body: `Record a short video${seconds ? `, up to ${seconds} seconds` : ''}. It stays on your profile for good.`,
    },
    { Icon: Users, title: 'Meet people through what they say', body: "Your answer unlocks the feed, so you can watch everyone else's." },
  ];

  return (
    <Screen>
      <View style={{ gap: 12 }}>
        <Text style={styles.eyebrow}>HOW IT WORKS</Text>
        <Text style={styles.title}>One question. Every day. On camera.</Text>
      </View>
      <View style={{ gap: 24 }}>
        {steps.map(({ Icon, title, body }) => (
          <View key={title} style={styles.step}>
            <View style={styles.icon}>
              <Icon size={20} color={colors.accentDog} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepBody}>{body}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <PrimaryButton label="Record My First Answer" onPress={() => router.replace('/question')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.5, color: colors.accentDog },
  title: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 40, color: colors.textPrimary },
  step: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentDogTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.textPrimary },
  stepBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
});
