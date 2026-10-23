import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Ban,
  EyeOff,
  Flag,
  Trash2,
  UserMinus,
  UserPlus,
  type LucideProps,
} from 'lucide-react-native';
import { colors, fonts } from '../../theme';
import { AboutFollowingDialog } from './AboutFollowingDialog';

export type MoreMenuAction = 'follow' | 'unfollow' | 'not_interested' | 'report' | 'block' | 'delete_video' | 'cancel';

type Icon = ComponentType<LucideProps>;

type MenuRow = {
  key: MoreMenuAction;
  label: string;
  icon: Icon;
  destructive?: boolean;
  iconColor?: string;
};

type Props = {
  visible: boolean;
  isFollowed: boolean;
  /** Your own video (06kb): only Delete video and Cancel. */
  own?: boolean;
  firstName: string;
  age?: number | null;
  avatarUri?: string | null;
  onSelect: (action: MoreMenuAction) => void;
  onDismiss: () => void;
};

const DESTRUCTIVE = '#FF5C5C';

function menuTitle(firstName: string, age?: number | null): string {
  const name = firstName.trim();
  if (!name) return '';
  if (age != null && Number.isFinite(age)) return `${name}, ${age}`;
  return name;
}

function buildRows(isFollowed: boolean, own: boolean): MenuRow[] {
  if (own) {
    return [{ key: 'delete_video', label: 'Delete video', icon: Trash2, destructive: true, iconColor: DESTRUCTIVE }];
  }
  const followRow: MenuRow = isFollowed
    ? { key: 'unfollow', label: 'Unfollow', icon: UserMinus }
    : { key: 'follow', label: 'Follow', icon: UserPlus };
  return [
    followRow,
    { key: 'not_interested', label: 'Not Interested', icon: EyeOff },
    { key: 'report', label: 'Report', icon: Flag },
    { key: 'block', label: 'Block', icon: Ban, destructive: true, iconColor: DESTRUCTIVE },
  ];
}

/** 06e / 06p / 06k more-options sheet — order matches MVP. Own video on 06k: 06kb. */
export function MoreOptionsMenu({
  visible,
  isFollowed,
  own = false,
  firstName,
  age,
  avatarUri,
  onSelect,
  onDismiss,
}: Props) {
  const rows = useMemo(() => buildRows(isFollowed, own), [isFollowed, own]);
  const title = menuTitle(firstName, age);

  /** The tap that opens this sheet would also hit the backdrop and close it immediately. */
  const [dismissable, setDismissable] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  useEffect(() => {
    if (!visible) {
      setDismissable(false);
      setAboutOpen(false);
      return;
    }
    const t = setTimeout(() => setDismissable(true), 250);
    return () => clearTimeout(t);
  }, [visible]);

  function pick(action: MoreMenuAction) {
    onDismiss();
    if (action !== 'cancel') onSelect(action);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissable ? onDismiss : undefined} accessibilityLabel="Dismiss" />
        <View style={styles.sheet}>
          {!own && title ? (
            <>
              <View style={styles.headerRow}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} accessibilityIgnoresInvertColors />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{(firstName.trim()[0] || '?').toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.headerName}>{title}</Text>
              </View>
              <View style={styles.divider} />
            </>
          ) : null}

          {rows.map((row) => {
            const iconColor = row.iconColor ?? (row.destructive ? DESTRUCTIVE : colors.textDarkMuted);
            const Icon = row.icon;
            const showAbout = row.key === 'follow';
            return (
              <View key={row.key}>
                <View style={styles.optionRow}>
                  <Pressable
                    style={styles.optionRowMain}
                    onPress={() => pick(row.key)}
                    accessibilityRole="button"
                    accessibilityLabel={row.label}
                  >
                    <Icon size={18} color={iconColor} />
                    <Text style={[styles.optionLabel, row.destructive && styles.destructiveLabel]}>{row.label}</Text>
                  </Pressable>
                  {showAbout ? (
                    <Pressable
                      style={styles.aboutPill}
                      onPress={() => setAboutOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel="About following"
                      hitSlop={6}
                    >
                      <Text style={styles.aboutPillLabel}>About following</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.divider} />
              </View>
            );
          })}

          <View style={styles.cancelWrap}>
            <Pressable style={styles.cancelButton} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <AboutFollowingDialog visible={aboutOpen} onDismiss={() => setAboutOpen(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000B3',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 20,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  headerName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white, flexShrink: 1 },
  divider: { height: 1, backgroundColor: colors.borderDark, alignSelf: 'stretch' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  optionRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
    flex: 1,
  },
  aboutPill: {
    backgroundColor: '#FFFFFF14',
    borderRadius: 9999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexShrink: 0,
  },
  aboutPillLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: colors.textDarkMuted,
  },
  optionLabel: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white },
  destructiveLabel: { fontFamily: fonts.bodyBold, color: DESTRUCTIVE },
  cancelWrap: { paddingTop: 16 },
  cancelButton: {
    backgroundColor: '#FFFFFF14',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
});
