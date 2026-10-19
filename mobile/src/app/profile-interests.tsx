import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { getInterestsPickerRequest, sameChoices } from '../lib/profilePicker';
import { filterInterestOptions } from '../lib/filterInterestOptions';
import { tryToggleInterest } from '../lib/tryToggleInterest';
import { DiscardProfileChangesDialog } from '../components/profile/DiscardProfileChangesDialog';
import { InterestsLimitDialog } from '../components/profile/InterestsLimitDialog';
import {
  AppTextInput,
  BackButton,
  Chip,
  PrimaryButton,
  Screen,
  TitleGroup,
} from '../components/ui';
import { colors, fonts } from '../theme';

const HEADER_LABEL_GAP = 12;

/**
 * 03e Interests: up to 5 picks from the full list. Done stays off until something changes;
 * leaving with unsaved changes shows the same "Discard changes?" dialog as Build / Edit Profile.
 */
export default function ProfileInterestsPicker() {
  const request = getInterestsPickerRequest();
  const navigation = useNavigation();
  const footerGap = FOOTER_MIN_GAP;
  const gapAboveDone = FOOTER_MIN_GAP;
  const [picked, setPicked] = useState<string[]>(() => request?.value ?? []);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);
  const [limitVisible, setLimitVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const allowLeaveRef = useRef(false);

  const dirty = request ? !sameChoices(picked, request.value) : false;
  const searching = search.trim().length > 0;

  const visibleOptions = useMemo(
    () => (request ? filterInterestOptions(request.options, search) : []),
    [request, search],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates: { height: number } }) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!request) router.back();
  }, [request]);

  const leave = useCallback(() => {
    allowLeaveRef.current = true;
    router.back();
  }, []);

  const attemptLeave = useCallback(() => {
    if (dirty) setDiscardVisible(true);
    else leave();
  }, [dirty, leave]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (limitVisible) {
          setLimitVisible(false);
          return true;
        }
        if (discardVisible) {
          setDiscardVisible(false);
          return true;
        }
        if (!dirty) return false;
        setDiscardVisible(true);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [discardVisible, dirty, limitVisible]),
  );

  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current) return;
      event.preventDefault();
      setDiscardVisible(true);
    });
  }, [dirty, navigation]);

  if (!request) return null;
  const max = request.max;
  const doneLabel = `Done (${picked.length} of ${max})`;
  const footerBottomPad = keyboardHeight > 0 ? keyboardHeight + 12 : footerGap;

  function done() {
    if (!request || !dirty) return;
    request.onDone(picked);
    leave();
  }

  function onToggleInterest(value: string) {
    const next = tryToggleInterest(picked, value, max);
    if (next.blockedByLimit) {
      setLimitVisible(true);
      return;
    }
    setPicked(next.list);
  }

  return (
    <Screen edges={['top', 'bottom']} flush>
      <DiscardProfileChangesDialog
        visible={discardVisible}
        onKeepEditing={() => setDiscardVisible(false)}
        onLeave={() => {
          setDiscardVisible(false);
          leave();
        }}
      />
      <InterestsLimitDialog visible={limitVisible} onDismiss={() => setLimitVisible(false)} />
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <BackButton onPress={attemptLeave} />
          <Text
            style={[styles.headerTitle, searchFocused && styles.headerTitleCompact]}
            numberOfLines={1}
          >
            Interests
          </Text>
          <View
            style={[
              styles.search,
              searchFocused ? styles.searchExpanded : styles.searchCompact,
              (searching || searchFocused) && styles.searchActive,
            ]}
          >
            <Search
              size={16}
              color={searching || searchFocused ? colors.accentDog : colors.textSecondary}
            />
            <AppTextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              disableFieldFocusBehavior
            />
            {search ? (
              <Pressable
                onPress={() => setSearch('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <X size={16} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={styles.body}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <TitleGroup subtitle={`Pick up to ${max} things you love.`} />
            <View style={styles.pills}>
              {visibleOptions.length === 0 ? (
                <Text style={styles.emptySearch}>No interests match your search.</Text>
              ) : (
                visibleOptions.map((value) => (
                  <Chip
                    key={value}
                    label={value}
                    selected={picked.includes(value)}
                    onPress={() => onToggleInterest(value)}
                  />
                ))
              )}
            </View>
          </ScrollView>
          <View style={{ paddingTop: gapAboveDone, paddingBottom: footerBottomPad }}>
            <PrimaryButton label={doneLabel} onPress={done} disabled={!dirty} />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const FOOTER_MIN_GAP = 24;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  body: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.textPrimary,
  },
  headerTitleCompact: {
    flexGrow: 0,
    flexShrink: 1,
    marginRight: HEADER_LABEL_GAP,
    maxWidth: '42%',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchCompact: {
    width: '26%',
    maxWidth: 132,
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 96,
  },
  searchExpanded: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    marginLeft: 0,
  },
  searchActive: { borderColor: colors.accentDog },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
    minHeight: 22,
    minWidth: 0,
  },
  scroll: { gap: 20, paddingBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emptySearch: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    width: '100%',
  },
});
