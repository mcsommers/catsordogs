import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clapperboard, Heart, User } from 'lucide-react-native';
import { getConversations, getIncomingMatchRequests, hasMatchesTabAlert } from '../../lib/social';
import { tabBarBottomPadding } from '../../lib/tabBarLayout';
import { colors, fonts } from '../../theme';

const ICONS = { feed: Clapperboard, matches: Heart, profile: User } as const;
const LABELS = { feed: 'Feed', matches: 'Matches', profile: 'Profile' } as const;

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [matchesAlert, setMatchesAlert] = useState(false);

  const refreshMatchesAlert = useCallback(async () => {
    try {
      const [incoming, conversations] = await Promise.all([
        getIncomingMatchRequests(),
        getConversations(),
      ]);
      setMatchesAlert(hasMatchesTabAlert(incoming, conversations));
    } catch {
      setMatchesAlert(false);
    }
  }, []);

  useEffect(() => {
    void refreshMatchesAlert();
  }, [pathname, refreshMatchesAlert]);

  return (
    <View style={[styles.wrapper, { paddingBottom: tabBarBottomPadding(insets.bottom) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const name = route.name as keyof typeof ICONS;
          const Icon = ICONS[name];
          const active = state.index === index;
          const matchesHighlight = name === 'matches' && matchesAlert && !active;
          const iconColor = active ? colors.white : matchesHighlight ? colors.accentDog : colors.tabInactive;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={
                name === 'matches' && matchesAlert && !active
                  ? 'Matches, new activity'
                  : LABELS[name]
              }
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={[styles.tab, active && { backgroundColor: colors.accentDog }]}
            >
              <Icon
                size={18}
                color={iconColor}
                fill={matchesHighlight ? colors.accentDog : 'transparent'}
              />
              <Text
                style={[
                  styles.label,
                  { color: active ? colors.white : colors.tabInactive },
                  active && { fontFamily: fonts.bodyBold },
                ]}
              >
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
