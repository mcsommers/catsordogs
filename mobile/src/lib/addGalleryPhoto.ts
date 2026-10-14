import * as ImagePicker from 'expo-image-picker';
import { attachPhotoUrls, type ProfilePhoto } from './profile';
import { profileSaveProblem, SAVE_ERROR } from './profileForm';
import { MAX_GALLERY_PHOTOS, galleryPhotoCount, nextGalleryPosition } from './profilePhotos';
import {
  PROFILE_PHOTO_CONTENT_TYPE,
  PROFILE_PHOTO_EXT,
  readProfilePhotoBytes,
} from './profilePhotoUpload';
import { supabase } from './supabase';

export type AddGalleryPhotoResult =
  | { ok: true; photos: ProfilePhoto[] }
  | { ok: false; canceled: true }
  | { ok: false; canceled: false; banner: string };

export async function fetchOwnProfilePhotos(): Promise<ProfilePhoto[]> {
  const { data, error } = await supabase.from('profile_photos').select('id, position, storage_path').order('position');
  if (error) throw error;
  const rows = (data ?? []) as ProfilePhoto[];
  return rows.length ? attachPhotoUrls(rows) : [];
}

/** Opens the library picker and uploads one gallery photo (positions 2–7). */
export async function pickAndAddGalleryPhoto(
  userId: string,
  existingPhotos: ProfilePhoto[]
): Promise<AddGalleryPhotoResult> {
  const position = nextGalleryPosition(existingPhotos);
  if (!position || galleryPhotoCount(existingPhotos) >= MAX_GALLERY_PHOTOS) {
    return { ok: false, canceled: true };
  }
  if (existingPhotos.some((p) => p.position === position)) {
    return { ok: false, canceled: true };
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, canceled: true };

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [4, 5],
    base64: true,
  });
  if (picked.canceled || !picked.assets[0]) return { ok: false, canceled: true };

  const asset = picked.assets[0];
  const path = `${userId}/${Date.now()}.${PROFILE_PHOTO_EXT}`;
  try {
    const bytes = await readProfilePhotoBytes(asset);
    const up = await supabase.storage
      .from('profile-photos')
      .upload(path, bytes, { contentType: PROFILE_PHOTO_CONTENT_TYPE, upsert: false });
    if (up.error) throw up.error;
    const ins = await supabase.from('profile_photos').insert({ user_id: userId, position, storage_path: path });
    if (ins.error) throw ins.error;
    const photos = await fetchOwnProfilePhotos();
    return { ok: true, photos };
  } catch (e) {
    await supabase.storage.from('profile-photos').remove([path]).catch(() => {});
    const { banner } = profileSaveProblem(e as Error, 'photo');
    return { ok: false, canceled: false, banner: banner ?? SAVE_ERROR };
  }
}
