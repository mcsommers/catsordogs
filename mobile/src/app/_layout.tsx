import { useEffect, type ReactNode } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import { FunnelSans_400Regular, FunnelSans_600SemiBold, FunnelSans_700Bold } from '@expo-google-fonts/funnel-sans';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { needsSignIn } from '../lib/routing';
import { colors } from '../theme';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({ Anton_400Regular, FunnelSans_400Regular, FunnelSans_600SemiBold, FunnelSans_700Bold });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="auto" />
        <SignedOutGuard>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="question" options={{ gestureEnabled: false, contentStyle: { backgroundColor: colors.bgDark } }} />
            <Stack.Screen name="review" options={{ gestureEnabled: false, contentStyle: { backgroundColor: colors.bgDark } }} />
            <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
            <Stack.Screen name="browse-questions" options={{ contentStyle: { backgroundColor: colors.bgDark } }} />
            <Stack.Screen name="my-answers" options={{ contentStyle: { backgroundColor: colors.bgDark } }} />
            <Stack.Screen name="user/[id]" options={{ contentStyle: { backgroundColor: colors.bgDark } }} />
            <Stack.Screen name="user/[id]/photos" options={{ contentStyle: { backgroundColor: colors.bgDark } }} />
            <Stack.Screen name="answer/[answerId]" options={{ contentStyle: { backgroundColor: colors.bgDark }, gestureEnabled: true }} />
          </Stack>
        </SignedOutGuard>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

/** If a signed-out person lands on a signed-in screen (common on Android QR scans), send them to Welcome once. */
function SignedOutGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const screen = useSegments()[0];
  const router = useRouter();

  useEffect(() => {
    if (loading || session) return;
    if (needsSignIn(screen, false)) router.replace('/welcome');
  }, [loading, session, screen]);

  return children;
}
