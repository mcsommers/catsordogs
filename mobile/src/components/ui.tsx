import {
  forwardRef,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, CircleAlert, Globe, Apple, type LucideProps } from 'lucide-react-native';
import { colors, fonts } from '../theme';

type Icon = ComponentType<LucideProps>;

export function Screen({
  children,
  dark = false,
  scroll = false,
  edges = ['top', 'bottom'],
  scrollRef,
  scrollContentRef,
}: {
  children: ReactNode;
  dark?: boolean;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
  /** When `scroll` is true, attach to the inner ScrollView (e.g. to scroll on field focus). */
  scrollRef?: RefObject<ScrollView | null>;
  /** When `scroll` is true, attach to the content wrapper (for scroll-to-field on validation). */
  scrollContentRef?: RefObject<View | null>;
}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const bg = { backgroundColor: dark ? colors.bgDark : colors.bg };

  useEffect(() => {
    if (!scroll) return;
    const onShow = (e: { endCoordinates: { height: number } }) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scroll]);

  const scrollContentStyle = [
    styles.scrollContent,
    keyboardHeight > 0 && { paddingBottom: 40 + keyboardHeight },
  ];
  const scrollInner = (
    <View ref={scrollContentRef} collapsable={false} style={styles.scrollInner}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.flex, bg]} edges={edges}>
      {scroll ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={scrollContentStyle}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {scrollInner}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.flex, styles.content]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export { scrollScreenToEnd, scrollToFieldInScreen } from '../lib/formScroll';

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.primary, (disabled || loading) && styles.dimmed, pressed && styles.pressed, style]}
    >
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryLabel}>{label}</Text>}
    </Pressable>
  );
}

export function TextLink({
  label,
  onPress,
  color = colors.accentCat,
  size = 13,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
}) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={10}>
      <Text style={[styles.link, { color, fontSize: size }]}>{label}</Text>
    </Pressable>
  );
}

export function BackButton({ onPress, dark = false }: { onPress?: () => void; dark?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/welcome')))}
      style={[styles.back, dark && { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark }]}
      hitSlop={8}
    >
      <ArrowLeft size={18} color={dark ? colors.white : colors.textPrimary} />
    </Pressable>
  );
}

export function TitleGroup({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export type FieldRequirement = 'required' | 'optional';

export function FieldLabelRow({ label, requirement }: { label: string; requirement?: FieldRequirement }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {requirement === 'required' ? <RequiredTag /> : null}
      {requirement === 'optional' ? <Text style={styles.optionalTag}>Optional</Text> : null}
    </View>
  );
}

export function RequiredTag() {
  return (
    <View style={styles.requiredTag}>
      <Text style={styles.requiredTagLabel}>Required</Text>
    </View>
  );
}

export const TextField = forwardRef(function TextField(
  {
    label,
    icon: IconComponent,
    error = false,
    requirement,
    ...input
  }: { label: string; icon: Icon; error?: boolean; requirement?: FieldRequirement } & TextInputProps,
  ref: Ref<TextInput>
) {
  return (
    <View style={{ gap: 6 }}>
      <FieldLabelRow label={label} requirement={requirement} />
      <View style={[styles.inputBox, error && { borderColor: colors.danger }]}>
        <IconComponent size={18} color={error ? colors.danger : colors.textSecondary} />
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={label}
          {...input}
        />
      </View>
    </View>
  );
});

/** A field that opens a picker instead of the keyboard (e.g. Birthday). */
export function PressableField({
  label,
  icon: IconComponent,
  value,
  placeholder,
  onPress,
  error = false,
  requirement,
}: {
  label: string;
  icon: Icon;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  error?: boolean;
  requirement?: FieldRequirement;
}) {
  return (
    <View style={{ gap: 6 }}>
      <FieldLabelRow label={label} requirement={requirement} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[styles.inputBox, error && { borderColor: colors.danger }]}
      >
        <IconComponent size={18} color={error ? colors.danger : colors.textSecondary} />
        <Text style={[styles.input, { color: value ? colors.textPrimary : colors.textSecondary }]}>{value ?? placeholder}</Text>
      </Pressable>
    </View>
  );
}

/** Apple and Google sign-in are not set up yet, so both buttons show "Coming soon" and do nothing. */
export function ComingSoonSocialButtons() {
  return (
    <View style={{ gap: 12 }}>
      {[
        { label: 'Continue with Apple', Icon: Apple },
        { label: 'Continue with Google', Icon: Globe },
      ].map(({ label, Icon: I }) => (
        <View
          key={label}
          style={styles.social}
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={`${label}, coming soon`}
        >
          <I size={18} color={colors.textSecondary} />
          <Text style={styles.socialLabel}>{label}</Text>
          <View style={styles.soonTag}>
            <Text style={styles.soonLabel}>Coming soon</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function OrDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.line} />
      <Text style={styles.or}>or</Text>
      <View style={styles.line} />
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <CircleAlert size={18} color={colors.danger} />
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

export function FormMessage({ message, tone = 'error' }: { message: string | null; tone?: 'error' | 'info' }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={[styles.formMessage, tone === 'info' && { color: colors.textSecondary }]}>
      {message}
    </Text>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.accentDog, borderColor: colors.accentDog }]}
    >
      <Text style={[styles.chipLabel, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function SelectRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.selectRow, selected && { backgroundColor: colors.accentDogTint, borderColor: colors.accentDog }]}
    >
      <View style={{ gap: 2, flex: 1 }}>
        <Text style={styles.selectTitle}>{title}</Text>
        {subtitle ? <Text style={styles.selectSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.radio, selected && { borderColor: colors.accentDog }]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

export function SectionHeader({
  title,
  helper,
  requirement,
}: {
  title: string;
  helper?: string;
  requirement?: FieldRequirement;
}) {
  const helperText =
    requirement === 'optional' && helper ? `Optional · ${helper}` : requirement === 'optional' ? 'Optional' : helper;
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionHeaderEnd}>
        {requirement === 'required' ? <RequiredTag /> : null}
        {helperText ? <Text style={styles.sectionHelper}>{helperText}</Text> : null}
      </View>
    </View>
  );
}

/** The dark centered dialog used on the recording and review screens (04c, 04f, 05c). */
export function Dialog({
  visible,
  icon: IconComponent,
  iconTone = 'warning',
  title,
  body,
  primary,
  secondary,
}: {
  visible: boolean;
  icon: Icon;
  iconTone?: 'warning' | 'success';
  title: string;
  body: string;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}) {
  const success = iconTone === 'success';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={secondary?.onPress ?? primary.onPress}>
      <View style={styles.scrim}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={[styles.dialogIcon, success && { backgroundColor: colors.accentDog }]}>
            <IconComponent size={success ? 26 : 22} color={success ? colors.white : colors.accentDog} />
          </View>
          <Text style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogBody}>{body}</Text>
          <PrimaryButton label={primary.label} onPress={primary.onPress} style={{ alignSelf: 'stretch', marginTop: 8 }} />
          {secondary ? (
            <Pressable accessibilityRole="button" onPress={secondary.onPress} hitSlop={8} style={{ paddingVertical: 6 }}>
              <Text style={styles.dialogSecondary}>{secondary.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export function QuestionBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>TODAY&apos;S QUESTION</Text>
    </View>
  );
}

export function CenteredSpinner({ dark = false }: { dark?: boolean }) {
  return (
    <View style={[styles.flex, styles.center, { backgroundColor: dark ? colors.bgDark : colors.bg }]}>
      <ActivityIndicator color={colors.accentDog} />
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 28 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  scrollInner: { gap: 28 },
  primary: {
    backgroundColor: colors.accentDog,
    borderRadius: 9999,
    paddingVertical: 17,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  primaryLabel: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 16 },
  dimmed: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  link: { fontFamily: fonts.bodyBold, textAlign: 'center' },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSecondary },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSecondary },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requiredTag: {
    backgroundColor: '#FF6B3526',
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  requiredTagLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.3, color: colors.accentDog },
  optionalTag: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textSecondary },
  sectionHeaderEnd: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, justifyContent: 'flex-end' },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 16,
    minHeight: 50,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.textPrimary, paddingVertical: 14 },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    paddingVertical: 15,
    paddingHorizontal: 24,
  },
  socialLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.textSecondary },
  soonTag: { backgroundColor: colors.borderSubtle, borderRadius: 9999, paddingVertical: 3, paddingHorizontal: 8 },
  soonLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.textSecondary },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  or: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.dangerTint,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bannerText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, color: colors.danger },
  formMessage: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, color: colors.danger },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  chipLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textPrimary },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    padding: 16,
  },
  selectTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textPrimary },
  selectSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentDog },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  sectionHelper: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  scrim: { flex: 1, backgroundColor: '#000000B3', alignItems: 'center', justifyContent: 'center', padding: 32 },
  dialog: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceDark,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  dialogIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF6B3526',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.white, textAlign: 'center' },
  dialogBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textDarkMuted, textAlign: 'center' },
  dialogSecondary: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white, textAlign: 'center' },
  badge: {
    backgroundColor: '#FF6B3526',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.accentDog,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'center',
  },
  badgeLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, color: colors.accentDog },
});
