import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../../theme';

export const PROFILE_PHOTO_REQUIRED_HINT = 'Profile photo is required';

/** True when the user has chosen a profile photo (position 1), including a not-yet-uploaded pick. */
export function hasProfilePhoto(photos: { position: number }[]): boolean {
  return photos.some((p) => p.position === 1);
}

export function ProfilePhotoRequiredHint({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <Text style={styles.hint}>{PROFILE_PHOTO_REQUIRED_HINT}</Text>;
}

const styles = StyleSheet.create({
  hint: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    textAlign: 'center',
  },
});
