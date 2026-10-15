import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Plus } from 'lucide-react-native';
import type { ProfilePhoto } from '../../lib/profile';
import { MAX_GALLERY_PHOTOS, galleryPhotos } from '../../lib/profilePhotos';
import { PROFILE_PAD } from './profileLayout';
import { colors, fonts } from '../../theme';

const GRID_GAP = 6;
const COLS = 3;

type Props = {
  photos: ProfilePhoto[];
  /** Index in the list of displayed photos (with URLs), for the photo viewer. */
  onPhotoPress: (displayIndex: number) => void;
  ownProfile?: boolean;
  firstName?: string;
  onAddPhotoPress?: () => void;
  addPhotoDisabled?: boolean;
};

export function ProfilePhotoGrid({
  photos,
  onPhotoPress,
  ownProfile,
  firstName,
  onAddPhotoPress,
  addPhotoDisabled,
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const cellW = (screenW - PROFILE_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS;
  const cellH = 115;

  const withUrls = galleryPhotos(photos).filter((p) => p.url);
  const showAdd = ownProfile && withUrls.length < MAX_GALLERY_PHOTOS;

  if (!ownProfile && withUrls.length === 0) {
    const who = firstName?.trim() || 'This user';
    return <Text style={styles.empty}>{who} hasn&apos;t added any photos yet.</Text>;
  }

  return (
    <View style={styles.grid}>
      {withUrls.map((ph, index) => (
        <Pressable
          key={ph.storage_path}
          style={[styles.cell, { width: cellW, height: cellH }]}
          onPress={() => onPhotoPress(index)}
          accessibilityRole="button"
        >
          <Image source={{ uri: ph.url! }} style={styles.image} resizeMode="cover" />
        </Pressable>
      ))}
      {showAdd ? (
        <Pressable
          style={[styles.cell, styles.addCell, { width: cellW, height: cellH }, addPhotoDisabled && styles.addCellDisabled]}
          onPress={onAddPhotoPress}
          disabled={addPhotoDisabled}
          accessibilityRole="button"
          accessibilityLabel="Add photo"
        >
          <View style={styles.addCircle}>
            <Plus size={16} color={colors.white} />
          </View>
          <Text style={styles.addLabel}>Add photo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceDark,
  },
  addCell: { alignItems: 'center', justifyContent: 'center' },
  addCellDisabled: { opacity: 0.5 },
  image: { width: '100%', height: '100%' },
  addCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentDog,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  addLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textDarkMuted },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textDarkMuted },
});
