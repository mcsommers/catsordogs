import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ImagePlus, Plus, X } from 'lucide-react-native';
import { FieldLabelRow, SectionHeader } from '../ui';
import { PROFILE_ADDITIONAL_PHOTOS_LABEL } from '../../lib/profileForm';
import { colors, fonts } from '../../theme';

export type ProfileBuildPhoto = {
  id: string;
  position: number;
  storage_path: string;
  url?: string;
};

type Props = {
  section: 'avatar' | 'more';
  photos: ProfileBuildPhoto[];
  photoBusy: boolean;
  onAddAvatar: () => void;
  onAddMore: () => void;
  onRemove: (photo: ProfileBuildPhoto) => void;
};

const MORE_SLOTS = [2, 3, 4, 5, 6, 7];

export function ProfileBuildPhotos({ section, photos, photoBusy, onAddAvatar, onAddMore, onRemove }: Props) {
  const avatar = photos.find((p) => p.position === 1);
  const firstEmptyMore =
    MORE_SLOTS.find((n) => !photos.some((p) => p.position === n)) ?? null;

  if (section === 'avatar') {
    return (
      <View style={{ gap: 10, alignItems: 'center' }}>
        <View style={{ width: '100%', gap: 6 }}>
          <SectionHeader title="Profile photo" requirement="required" />
          <Text style={styles.avatarHint}>Used as your avatar in matches, chats, and lists.</Text>
        </View>
        <View style={styles.avatarHost}>
          {avatar ? (
            <>
              <View style={styles.avatarClip}>
                {avatar.url ? (
                  <Image source={{ uri: avatar.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove profile photo"
                onPress={() => onRemove(avatar)}
                style={styles.avatarRemove}
                hitSlop={8}
              >
                <X size={16} color={colors.white} />
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add profile photo"
              onPress={onAddAvatar}
              disabled={photoBusy}
              style={[styles.avatarClip, styles.avatarEmpty]}
            >
              <ImagePlus size={28} color={colors.accentDog} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
      <View style={{ gap: 10 }}>
        <View style={{ gap: 4 }}>
          <FieldLabelRow label={PROFILE_ADDITIONAL_PHOTOS_LABEL} requirement="optional" />
          <Text style={styles.avatarHint}>Up to 6 more. Shown on your profile grid (not your profile photo).</Text>
        </View>
        {[0, 1].map((row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 10 }}>
            {[0, 1, 2].map((col) => {
              const slot = row * 3 + col + 2;
              const photo = photos.find((p) => p.position === slot);
              if (photo) {
                return (
                  <View key={slot} style={styles.tile}>
                    {photo.url ? (
                      <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                      onPress={() => onRemove(photo)}
                      style={styles.removePhoto}
                      hitSlop={8}
                    >
                      <X size={14} color={colors.white} />
                    </Pressable>
                  </View>
                );
              }
              const canAdd = firstEmptyMore === slot;
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="button"
                  accessibilityLabel="Add a photo"
                  onPress={onAddMore}
                  disabled={photoBusy || !canAdd}
                  style={[styles.tile, styles.emptyTile, !canAdd && styles.emptyTileDisabled]}
                >
                  <Plus size={22} color={canAdd ? colors.textSecondary : colors.borderSubtle} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
  );
}

const AVATAR = 120;

const styles = StyleSheet.create({
  avatarHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  avatarHost: {
    width: AVATAR + 12,
    height: AVATAR + 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarClip: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  avatarEmpty: {
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.accentDogTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRemove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: { flex: 1, height: 112, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface },
  emptyTile: {
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTileDisabled: { opacity: 0.45 },
  removePhoto: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
