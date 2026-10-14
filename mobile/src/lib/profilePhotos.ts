import type { ProfilePhoto } from './profile';

export const PROFILE_AVATAR_POSITION = 1;
export const MAX_GALLERY_PHOTOS = 6;
export const GALLERY_POSITIONS = [2, 3, 4, 5, 6, 7] as const;

export function isAvatarPhoto(photo: ProfilePhoto): boolean {
  return photo.position === PROFILE_AVATAR_POSITION;
}

export function galleryPhotos(photos: ProfilePhoto[]): ProfilePhoto[] {
  return photos.filter((p) => !isAvatarPhoto(p)).sort((a, b) => a.position - b.position);
}

export function avatarPhoto(photos: ProfilePhoto[]): ProfilePhoto | undefined {
  return photos.find((p) => isAvatarPhoto(p));
}

export function nextGalleryPosition(photos: ProfilePhoto[]): number | null {
  const used = new Set(photos.map((p) => p.position));
  return GALLERY_POSITIONS.find((n) => !used.has(n)) ?? null;
}

export function galleryPhotoCount(photos: ProfilePhoto[]): number {
  return galleryPhotos(photos).length;
}
