import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { getInterestsPickerRequest, sameChoices } from "../lib/profilePicker";
import { toggleChoice } from "../lib/profileForm";
import { DiscardProfileChangesDialog } from "../components/profile/DiscardProfileChangesDialog";
import {
  BackButton,
  Chip,
  PrimaryButton,
  Screen,
  TitleGroup,
  styles as ui,
} from "../components/ui";
import { colors, fonts } from "../theme";

/**
 * 03e Interests: up to 5 picks from the full list. Done stays off until something changes;
 * leaving with unsaved changes shows the same "Discard changes?" dialog as Build / Edit Profile.
 */
export default function ProfileInterestsPicker() {
  const request = getInterestsPickerRequest();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Space below Done includes the phone's bottom bar. iPhone: the same gap goes above Done.
  // Android: the nav bar height is not counted above, so the visible gap matches the gap below.
  const footerGap = Math.max(FOOTER_MIN_GAP, insets.bottom);
  const gapAboveDone = Platform.OS === "ios" ? footerGap : FOOTER_MIN_GAP;
  const [picked, setPicked] = useState<string[]>(() => request?.value ?? []);
  const [discardVisible, setDiscardVisible] = useState(false);
  const allowLeaveRef = useRef(false);

  const dirty = request ? !sameChoices(picked, request.value) : false;

  useEffect(() => {
    // Opened without a request (for example after the app reloaded): nothing to pick for.
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
        if (discardVisible) {
          setDiscardVisible(false);
          return true;
        }
        if (!dirty) return false;
        setDiscardVisible(true);
        return true;
      };
      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        onHardwareBack,
      );
      return () => sub.remove();
    }, [discardVisible, dirty]),
  );

  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener("beforeRemove", (event) => {
      if (allowLeaveRef.current) return;
      event.preventDefault();
      setDiscardVisible(true);
    });
  }, [dirty, navigation]);

  if (!request) return null;
  const max = request.max;

  function done() {
    if (!request || !dirty) return;
    request.onDone(picked);
    leave();
  }

  return (
    <Screen edges={["top"]} flush>
      <DiscardProfileChangesDialog
        visible={discardVisible}
        onKeepEditing={() => setDiscardVisible(false)}
        onLeave={() => {
          setDiscardVisible(false);
          leave();
        }}
      />
      <View style={styles.page}>
        <View style={ui.header}>
          <BackButton onPress={attemptLeave} />
          <Text
            style={styles.counter}
          >{`${picked.length} of ${max} selected`}</Text>
        </View>
        <View style={styles.body}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            style={styles.flex}
          >
            <TitleGroup
              title="Interests"
              subtitle={`Pick up to ${max} things you love.`}
            />
            <View style={styles.pills}>
              {request.options.map((value) => (
                <Chip
                  key={value}
                  label={value}
                  selected={picked.includes(value)}
                  onPress={() =>
                    setPicked((current) => toggleChoice(current, value, max))
                  }
                />
              ))}
            </View>
          </ScrollView>
          <View style={{ paddingTop: gapAboveDone, paddingBottom: footerGap }}>
            <PrimaryButton label="Done" onPress={done} disabled={!dirty} />
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
  scroll: { gap: 20 },
  counter: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.accentDog,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
