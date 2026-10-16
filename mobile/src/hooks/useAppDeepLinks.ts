import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { hrefForAppDeepLink, parseAppDeepLink } from '../lib/appLinks';

function navigateFromUrl(url: string | null | undefined) {
  const target = parseAppDeepLink(url);
  if (!target) return;
  router.push(hrefForAppDeepLink(target));
}

/** Routes catsordogs:// links from notification emails into the right screen. */
export function useAppDeepLinks(enabled: boolean) {
  const linkingUrl = Linking.useLinkingURL();

  useEffect(() => {
    if (!enabled) return;
    navigateFromUrl(linkingUrl);
  }, [enabled, linkingUrl]);

  useEffect(() => {
    if (!enabled) return;
    Linking.getInitialURL().then((url) => navigateFromUrl(url));
  }, [enabled]);
}
