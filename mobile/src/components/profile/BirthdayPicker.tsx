import { useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PrimaryButton } from '../ui';
import { toIsoDate } from '../../lib/format';
import { birthdayPickerMinimumDate } from '../../lib/profileForm';
import { colors } from '../../theme';

type Props = {
  value: string | null;
  onDone: (iso: string | null) => void;
};

export function BirthdayPicker({ value, onDone }: Props) {
  const maximumDate = new Date();
  const minimumDate = birthdayPickerMinimumDate(maximumDate);
  const initial = value ? new Date(`${value}T12:00:00`) : new Date(2000, 0, 1);
  const [picked, setPicked] = useState(initial);

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={initial}
        mode="date"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onValueChange={(_event, date) => {
          if (date) onDone(toIsoDate(date));
        }}
        onDismiss={() => onDone(null)}
      />
    );
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={() => onDone(null)}>
      <View style={styles.sheetScrim}>
        <View style={styles.sheet}>
          <DateTimePicker
            value={picked}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onValueChange={(_event, date) => date && setPicked(date)}
            textColor={colors.textPrimary}
          />
          <PrimaryButton label="Done" onPress={() => onDone(toIsoDate(picked))} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#00000066',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    padding: 20,
    gap: 12,
  },
});
