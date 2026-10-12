import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Plus, Star } from 'lucide-react-native';
import type { ProfilePhoto } from '../../lib/profile';
import { PROFILE_PAD } from './profileLayout';
import { colors, fonts } from '../../theme';

const GRID_GAP = 6;
const COLS = 3;
const MAX_PHOTOS = 6;

type Props = {
  photos: ProfilePhoto[];
  /** Index in the list of displayed photos (with URLs), for the photo viewer. */
  onPhotoPress: (displayIndex: number) => void;
  ownProfile?: boolean;
  onAddPhotoPress?: () => void;
};

export function ProfilePhotoGrid({ photos, onPhotoPress, ownProfile, onAddPhotoPress }: Props) {
  const { width: screenW } = useWindowDimensions();
  const cellW = (screenW - PROFILE_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS;
  const cellH = 115;

  const withUrls = [...photos].filter((p) => p.url).sort((a, b) => a.position - b.position);
  const showAdd = ownProfile && withUrls.length < MAX_PHOTOS;

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
          {ownProfile && index === 0 ? (
            <View style={styles.mainBadge}>
              <Star size={11} color={colors.white} />
              <Text style={styles.mainLabel}>Main</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
      {showAdd ? (
        <Pressable
          style={[styles.cell, styles.addCell, { width: cellW, height: cellH }]}
          onPress={onAddPhotoPress}
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
  image: { width: '100%', height: '100%' },
  mainBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#000000A0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mainLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.white },
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
});
