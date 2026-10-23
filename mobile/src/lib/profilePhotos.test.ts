import {
  MAX_GALLERY_PHOTOS,
  galleryPhotoCount,
  galleryPhotos,
  nextGalleryPosition,
} from './profilePhotos';
import type { ProfilePhoto } from './profile';

function photo(position: number): ProfilePhoto {
  return { position, storage_path: `u/${position}.jpg`, url: `https://x/${position}` };
}

describe('profilePhotos', () => {
  it('excludes avatar from gallery', () => {
    const all = [photo(1), photo(2), photo(3)];
    expect(galleryPhotos(all).map((p) => p.position)).toEqual([2, 3]);
    expect(galleryPhotoCount(all)).toBe(2);
  });

  it('allows six gallery slots', () => {
    const all = [photo(1), ...[2, 3, 4, 5, 6, 7].map(photo)];
    expect(galleryPhotoCount(all)).toBe(MAX_GALLERY_PHOTOS);
    expect(nextGalleryPosition(all)).toBeNull();
  });

  it('picks next gallery position', () => {
    expect(nextGalleryPosition([photo(1), photo(2)])).toBe(3);
  });
});
