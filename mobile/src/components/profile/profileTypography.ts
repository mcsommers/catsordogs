import { colors, fonts } from '../../theme';

/** Type styles for 06j / 08 — match docs/pencil-new.pen ($font-heading section titles, $font-body elsewhere). */
export const profileType = {
  sectionTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.white },
  bodyMuted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textDarkMuted },
  countLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textDarkMuted },
  chipLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.white },
  statLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.white },
  goalLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.accentCat },
  goalValue: { fontFamily: fonts.body, fontSize: 14, color: colors.accentDog },
  archiveQuestion: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.white },
  archiveMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textDarkMuted },
  tagLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.white },
};
