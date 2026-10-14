import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';
import { profileType } from './profileTypography';

/** 06j Interests — filled accent-dog pill (Pencil Tag Chip instance). */
export function ProfileTagChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.accentDog,
    borderWidth: 1.5,
    borderColor: colors.accentDog,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  label: profileType.tagLabel,
});
