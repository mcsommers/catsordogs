import { Platform } from 'react-native';

export const TAB_BAR_HEIGHT = 56;

/** Bottom inset of the floating tab bar pill (matches `(tabs)/_layout.tsx`). */
export function tabBarBottomPadding(bottomInset: number): number {
  if (Platform.OS === 'android') {
    return bottomInset > 0 ? bottomInset + 18 : 38;
  }
  return Math.max(bottomInset, 16);
}

/** Total vertical space reserved at the bottom of tab screens for the tab bar. */
export function tabBarOverlayHeight(bottomInset: number): number {
  return tabBarBottomPadding(bottomInset) + TAB_BAR_HEIGHT;
}

/** Bottom padding for edge-aligned modals/sheets (06e more-options). Play builds need nav-bar clearance Expo Go may not report. */
export function bottomSheetPadding(bottomInset: number, base = 28): number {
  if (Platform.OS === 'android') {
    return base + (bottomInset > 0 ? bottomInset + 6 : 22);
  }
  return base + bottomInset;
}
