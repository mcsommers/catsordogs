import { StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';

/** Shared chrome for 06n Nudge Card and 07h Match Request Card. */
export const profileActionCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accentDog,
    padding: 14,
    gap: 14,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentDog,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 3 },
  title: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  body: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textDarkMuted },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnFull: { flex: 0, alignSelf: 'stretch' },
  actionBtnPrimary: { backgroundColor: colors.accentDog },
  actionBtnOutline: { borderWidth: 1.5, borderColor: colors.textDarkMuted },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
});
