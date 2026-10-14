import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function assertReadableImageBytes(bytes: Uint8Array): void {
  if (bytes.length < 128) {
    throw new Error('Image file is empty or could not be read. Try choosing the photo again.');
  }
}

/** Local URI for showing a picked photo before upload finishes. */
export function profilePhotoPreviewUri(asset: ImagePickerAsset): string {
  if (asset.base64) return `data:image/jpeg;base64,${asset.base64}`;
  return asset.uri;
}

/**
 * JPEG bytes for Supabase storage.
 * Android content:// URIs are unreliable with fetch(); use the file system (or base64 from the picker).
 */
export async function readProfilePhotoBytes(asset: ImagePickerAsset): Promise<Uint8Array> {
  if (asset.base64) {
    const bytes = base64ToBytes(asset.base64);
    assertReadableImageBytes(bytes);
    return bytes;
  }
  if (!asset.uri) throw new Error('No image data');

  if (Platform.OS === 'ios') {
    const res = await fetch(asset.uri);
    if (!res.ok) throw new Error('Could not read image');
    const bytes = new Uint8Array(await res.arrayBuffer());
    assertReadableImageBytes(bytes);
    return bytes;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  const bytes = base64ToBytes(b64);
  assertReadableImageBytes(bytes);
  return bytes;
}

export const PROFILE_PHOTO_CONTENT_TYPE = 'image/jpeg';
export const PROFILE_PHOTO_EXT = 'jpg';
