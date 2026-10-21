import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Chip, SectionHeader, styles as ui } from '../ui';
import { colors, fonts } from '../../theme';
import { featuredInterestsOnProfile } from '../../lib/featuredInterests';
import { tryToggleInterest } from '../../lib/tryToggleInterest';
import { InterestsLimitDialog } from './InterestsLimitDialog';

const QUICK_GENDERS = ['Woman', 'Man'];
const SHOW_HELPER = 'When off, only you can see it. It still helps with matching.';

/** The gender values behind the "More >" chip (everything except Woman and Man). */
export function moreGenderOptions(all: string[]): string[] {
  return all.filter((v) => !QUICK_GENDERS.includes(v));
}

/** Chip with a chevron: "More >" or "View more >" (Pencil 03 / 08d). */
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

/** Build Profile (03) and Edit Profile (08d): featured pills, live counter, View more opens 03e with current picks. */
export function BuildProfileInterestsSection({
  value,
  max,
  allOptions,
  onChange,
  onOpenFull,
}: {
  value: string[];
  max: number;
  allOptions: string[];
  onChange: (next: string[]) => void;
  onOpenFull: () => void;
}) {
  const [limitVisible, setLimitVisible] = useState(false);
  const pills = featuredInterestsOnProfile(allOptions);

  function toggleInterest(interest: string) {
    const next = tryToggleInterest(value, interest, max);
    if (next.blockedByLimit) {
      setLimitVisible(true);
      return;
    }
    onChange(next.list);
  }

  return (
    <View style={{ gap: 12 }}>
      <InterestsLimitDialog visible={limitVisible} onDismiss={() => setLimitVisible(false)} />
      <View style={ui.sectionHeader}>
        <View style={styles.titleWithCounter}>
          <Text style={ui.sectionTitle}>Interests</Text>
          <Text style={styles.selectionCounter}>({value.length} of {max})</Text>
        </View>
        <Text style={ui.sectionHelper}>Optional</Text>
      </View>
      <View style={styles.chips}>
        {pills.map((label) => (
          <Chip key={label} label={label} selected={value.includes(label)} onPress={() => toggleInterest(label)} />
        ))}
        <ChevronChip label="View more" selected={false} onPress={onOpenFull} />
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
  titleWithCounter: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  selectionCounter: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSecondary },
});
