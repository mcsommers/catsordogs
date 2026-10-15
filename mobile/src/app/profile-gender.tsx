import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getGenderPickerRequest } from '../lib/profilePicker';
import { BackButton, Screen, SelectRow, TitleGroup, styles as ui } from '../components/ui';

/** 03d Gender "More" list. Tapping a row picks it and returns to Build / Edit Profile. */
export default function ProfileGenderPicker() {
  const request = getGenderPickerRequest();

  useEffect(() => {
    // Opened without a request (for example after the app reloaded): nothing to pick for.
    if (!request) router.back();
  }, [request]);

  if (!request) return null;

  return (
    <Screen scroll>
      <View style={ui.headerWithTitle}>
        <BackButton />
        <Text style={ui.headerTitle}>Gender</Text>
      </View>
      <TitleGroup subtitle="Choose the option that best describes you." />
      <View style={styles.list}>
        {request.options.map((value) => (
          <SelectRow
            key={value}
            title={value}
            selected={request.value === value}
            onPress={() => {
              request.onDone(value);
              router.back();
            }}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
});
