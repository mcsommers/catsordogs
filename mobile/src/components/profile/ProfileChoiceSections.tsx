import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight, Pencil } from 'lucide-react-native';
import { Chip, SectionHeader, styles as ui } from '../ui';
import { colors, fonts } from '../../theme';

const QUICK_GENDERS = ['Woman', 'Man'];
const SHOW_HELPER = 'When off, only you can see it. It still helps with matching.';

/** The gender values behind the "More >" chip (everything except Woman and Man). */
export function moreGenderOptions(all: string[]): string[] {
  return all.filter((v) => !QUICK_GENDERS.includes(v));
}

/** Chip with a chevron: "More >" or "Select Interests >" (Pencil 03 More Chip / Select Interests Chip). */
function ChevronChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selected ? `${label}, change` : label}
      onPress={onPress}
      style={[styles.chevronChip, selected && styles.chevronChipSelected]}
    >
      <Text numberOfLines={1} style={[styles.chevronLabel, selected && { color: colors.white }]}>
        {label}
      </Text>
      <ChevronRight size={16} color={selected ? colors.white : colors.textSecondary} />
    </Pressable>
  );
}

function ShowOnProfileRow({
  title,
  value,
  onChange,
}: {
  title: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.showRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.showTitle}>{title}</Text>
        <Text style={styles.showHelper}>{SHOW_HELPER}</Text>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={title}
        accessibilityState={{ checked: value }}
        onPress={() => onChange(!value)}
        hitSlop={8}
        style={[styles.toggle, value ? styles.toggleOn : styles.toggleOff]}
      >
        <View style={styles.knob} />
      </Pressable>
    </View>
  );
}

export function GenderSection({
  allOptions,
  value,
  show,
  onSelect,
  onShowChange,
  onOpenMore,
  style,
}: {
  allOptions: string[];
  value: string | null;
  show: boolean;
  onSelect: (value: string) => void;
  onShowChange: (next: boolean) => void;
  onOpenMore: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const quick = QUICK_GENDERS.filter((v) => allOptions.includes(v));
  const moreChoice = value && !QUICK_GENDERS.includes(value) ? value : null;
  return (
    <View style={[{ gap: 12 }, style]}>
      <SectionHeader title="Gender" requirement="required" />
      <View style={styles.chips}>
        {quick.map((v) => (
          <Chip key={v} label={v} selected={value === v} onPress={() => onSelect(v)} />
        ))}
        <ChevronChip label={moreChoice ?? 'More'} selected={!!moreChoice} onPress={onOpenMore} />
      </View>
      <ShowOnProfileRow title="Show gender on my profile" value={show} onChange={onShowChange} />
    </View>
  );
}

export function OrientationSection({
  options,
  value,
  show,
  onChange,
  onShowChange,
}: {
  options: string[];
  value: string[];
  show: boolean;
  onChange: (next: string[]) => void;
  onShowChange: (next: boolean) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title="Sexual Orientation" helper="Choose one" requirement="optional" />
      <View style={styles.chips}>
        {options.map((v) => (
          <Chip
            key={v}
            label={v}
            selected={value.includes(v)}
            onPress={() => onChange(value.includes(v) ? [] : [v])}
          />
        ))}
      </View>
      <ShowOnProfileRow title="Show orientation on my profile" value={show} onChange={onShowChange} />
    </View>
  );
}

export function InterestsSection({ value, onOpen }: { value: string[]; onOpen: () => void }) {
  if (value.length === 0) {
    return (
      <View style={{ gap: 12 }}>
        <SectionHeader title="Interests" requirement="optional" />
        <View style={styles.chips}>
          <ChevronChip label="Select Interests" selected={false} onPress={onOpen} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <View style={ui.sectionHeader}>
        <Text style={ui.sectionTitle}>Interests</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit Interests" onPress={onOpen} hitSlop={8} style={styles.editLink}>
          <Pencil size={14} color={colors.accentDog} />
          <Text style={styles.editLabel}>Edit</Text>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {value.map((v) => (
          <Chip key={v} label={v} selected onPress={onOpen} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chevronChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 190,
    backgroundColor: colors.surface,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    paddingVertical: 9,
    paddingLeft: 16,
    paddingRight: 14,
  },
  chevronChipSelected: { backgroundColor: colors.accentDog, borderColor: colors.accentDog },
  chevronLabel: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textPrimary },
  showRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    padding: 16,
  },
  showTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textPrimary },
  showHelper: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  // Pencil "Toggle On": 44 x 26 pill, 3 padding, 20 white knob (drawn by hand so Android matches iOS).
  toggle: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.accentDog, alignItems: 'flex-end' },
  toggleOff: { backgroundColor: colors.borderSubtle, alignItems: 'flex-start' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentDog },
});
