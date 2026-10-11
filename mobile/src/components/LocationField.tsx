import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { fetchLocationSuggestions } from '../lib/locationSearch';
import { FieldLabelRow, styles as ui, type FieldRequirement } from './ui';
import { colors, fonts } from '../theme';

const DEBOUNCE_MS = 280;

type Props = {
  label: string;
  icon: LucideIcon;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  requirement?: FieldRequirement;
  maxLength?: number;
};

export function LocationField({
  label,
  icon: IconComponent,
  value,
  onChangeText,
  placeholder = 'Brooklyn, NY',
  requirement,
  maxLength = 100,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function scheduleSearch(text: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++requestId.current;
    debounceRef.current = setTimeout(async () => {
      const list = await fetchLocationSuggestions(trimmed);
      if (id !== requestId.current) return;
      setSuggestions(list);
      setSearching(false);
      setOpen(true);
    }, DEBOUNCE_MS);
  }

  function pick(suggestion: string) {
    requestId.current++;
    setSuggestions([]);
    setOpen(false);
    setSearching(false);
    onChangeText(suggestion);
  }

  const showList = open && suggestions.length > 0;

  return (
    <View style={{ gap: 6, zIndex: showList ? 2 : 0 }}>
      <FieldLabelRow label={label} requirement={requirement} />
      <View style={ui.inputBox}>
        <IconComponent size={18} color={colors.textSecondary} />
        <TextInput
          style={ui.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={label}
          value={value}
          maxLength={maxLength}
          autoCorrect={false}
          autoCapitalize="words"
          onChangeText={(t) => {
            onChangeText(t);
            scheduleSearch(t);
          }}
          onFocus={() => {
            if (suggestions.length) setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
          }}
        />
      </View>
      {showList ? (
        <View style={styles.list} accessibilityRole="menu">
          {suggestions.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="menuitem"
              onPressIn={() => pick(s)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
            >
              <Text style={styles.rowText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : searching ? (
        <Text style={ui.hint}>Searching…</Text>
      ) : null}
    </View>
  );
}

const styles = {
  list: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.white,
    overflow: 'hidden' as const,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textPrimary,
  },
};
