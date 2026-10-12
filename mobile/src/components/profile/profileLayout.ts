import { Platform } from 'react-native';

/** Horizontal inset on profile content (Pencil content width 353 on 393pt frame). */
export const PROFILE_PAD = 20;

export const HERO_HEIGHT_OTHER = 320;
export const HERO_HEIGHT_SELF = 300;

export const PROFILE_SCROLL_BOTTOM =
  Platform.OS === 'android' ? 150 : 100;
