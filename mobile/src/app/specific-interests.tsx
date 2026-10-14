import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getSpecificInterestsRequest } from '../lib/specificInterestsPicker';
import { toggleChoice } from '../lib/profileForm';
import { BackButton, Chip, Screen, styles as ui } from '../components/ui';
import { colors, fonts } from '../theme';

/**
 * 06ia Specific Interests: pick any number of interests that matter most. Each tap updates
 * Feed Settings right away (it is saved with Feed Settings' Save button). No limit, no Done button.
 */
export default function SpecificInterestsScreen() {
  const request = getSpecificInterestsRequest();
  const [picked, setPicked] = useState<string[]>(() => request?.value ?? []);

  useEffect(() => {
    // Opened without a request (for example after the app reloaded): nothing to pick for.
    if (!request) router.back();
  }, [request]);

  if (!request) return null;

  function toggle(value: string) {
    const next = toggleChoice(picked, value, null);
    setPicked(next);
    request?.onChange(next);
  }

  return (
    <Screen dark flush edges={['top', 'bottom']}>
      <View style={styles.page}>
        <View style={ui.header}>
          <BackButton onPress={() => router.back()} dark />
          <Text style={styles.counter}>{`${picked.length} selected`}</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} style={styles.flex}>
          <View style={{ gap: 8 }}>
            <Text style={styles.title}>Specific Interests</Text>
            <Text style={styles.subtitle}>
              Choose every interest that matters most to you. People who share them rank higher. There is no limit.
            </Text>
          </View>
          <View style={styles.pills}>
            {request.options.map((value) => (
              <Chip key={value} label={value} selected={picked.includes(value)} onPress={() => toggle(value)} />
            ))}
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  scroll: { gap: 20, paddingBottom: 24 },
  counter: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentDog },
  title: { ...ui.title, color: colors.white },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textDarkMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
