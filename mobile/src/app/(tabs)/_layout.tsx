import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clapperboard, Heart, User } from 'lucide-react-native';
import { colors, fonts } from '../../theme';

const ICONS = { feed: Clapperboard, matches: Heart, profile: User } as const;
const LABELS = { feed: 'Feed', matches: 'Matches', profile: 'Profile' } as const;

/** Android 3-button nav often reports 0 safe-area inset; keep the pill above the system bar. */
function tabBarBottomPadding(bottomInset: number): number {
  if (Platform.OS === 'android') {
    return bottomInset > 0 ? bottomInset + 18 : 38;
  }
  return Math.max(bottomInset, 16);
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { paddingBottom: tabBarBottomPadding(insets.bottom) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const name = route.name as keyof typeof ICONS;
          const Icon = ICONS[name];
          const active = state.index === index;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={[styles.tab, active && { backgroundColor: colors.accentDog }]}
            >
              <Icon size={18} color={active ? colors.white : colors.tabInactive} />
              <Text style={[styles.label, { color: active ? colors.white : colors.tabInactive }, active && { fontFamily: fonts.bodyBold }]}>
                {LABELS[name]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="matches" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20 },
  bar: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1A1CF2',
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.33,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6, borderRadius: 16 },
  label: { fontFamily: fonts.bodySemi, fontSize: 10 },
});
