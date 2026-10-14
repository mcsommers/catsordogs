import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { getSpecificInterestsRequest } from '../lib/specificInterestsPicker';
import { sameChoices } from '../lib/profilePicker';
import { toggleChoice } from '../lib/profileForm';
import { DiscardProfileChangesDialog } from '../components/profile/DiscardProfileChangesDialog';
import { BackButton, Chip, PrimaryButton, Screen, styles as ui } from '../components/ui';
import { colors, fonts } from '../theme';

/**
 * 06ia Specific Interests: pick any number of interests that matter most. Done stays off until
 * something changes and hands the picks back to Feed Settings (saved with its Save button).
 * Leaving with unsaved changes shows the "Discard changes?" dialog, as on 03e.
 */
export default function SpecificInterestsScreen() {
  const request = getSpecificInterestsRequest();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const footerGap = Platform.OS === 'ios' ? Math.max(FOOTER_MIN_GAP, insets.bottom) : FOOTER_MIN_GAP;
  const gapAboveDone = Platform.OS === 'ios' ? footerGap : FOOTER_MIN_GAP;
  const [picked, setPicked] = useState<string[]>(() => request?.value ?? []);
  const [discardVisible, setDiscardVisible] = useState(false);
  const allowLeaveRef = useRef(false);

  const dirty = request ? !sameChoices(picked, request.value) : false;

  useEffect(() => {
    // Opened without a request (for example after the app reloaded): nothing to pick for.
    if (!request) router.back();
  }, [request]);

  const leave = useCallback(() => {
    allowLeaveRef.current = true;
    router.back();
  }, []);

  const attemptLeave = useCallback(() => {
    if (dirty) setDiscardVisible(true);
    else leave();
  }, [dirty, leave]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (discardVisible) {
          setDiscardVisible(false);
          return true;
        }
        if (!dirty) return false;
        setDiscardVisible(true);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [discardVisible, dirty]),
  );

  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current) return;
      event.preventDefault();
      setDiscardVisible(true);
    });
  }, [dirty, navigation]);

  if (!request) return null;

  function done() {
    if (!request || !dirty) return;
    request.onChange(picked);
    leave();
  }

  return (
    // Android: the screen itself keeps clear of the 3-button nav bar, so Done is never covered.
    <Screen dark flush edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['top']}>
      <DiscardProfileChangesDialog
        visible={discardVisible}
        onKeepEditing={() => setDiscardVisible(false)}
        onLeave={() => {
          setDiscardVisible(false);
          leave();
        }}
      />
      <View style={styles.page}>
        <View style={ui.header}>
          <BackButton onPress={attemptLeave} dark />
          <Text style={styles.counter}>{`${picked.length} selected`}</Text>
        </View>
        <View style={styles.flex}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} style={styles.flex}>
            <View style={{ gap: 8 }}>
              <Text style={styles.title}>Specific Interests</Text>
              <Text style={styles.subtitle}>
                Choose every interest that matters most to you. People who share them rank higher. There is no limit.
              </Text>
            </View>
            <View style={styles.pills}>
              {request.options.map((value) => (
                <Chip
                  dark
                  key={value}
                  label={value}
                  selected={picked.includes(value)}
                  onPress={() => setPicked((current) => toggleChoice(current, value, null))}
                />
              ))}
            </View>
          </ScrollView>
          <View style={{ paddingTop: gapAboveDone, paddingBottom: footerGap }}>
            <PrimaryButton label="Done" onPress={done} disabled={!dirty} />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const FOOTER_MIN_GAP = 24;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  scroll: { gap: 20 },
  counter: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentDog },
  title: { ...ui.title, color: colors.white },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textDarkMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
