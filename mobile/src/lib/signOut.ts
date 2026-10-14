import { InteractionManager } from 'react-native';
import { supabase } from './supabase';

/** Leave signed-in screens before clearing the session so feed video players unmount cleanly (Android). */
export async function signOutToWelcome(router: { replace: (href: string) => void }) {
  router.replace('/welcome');
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  await supabase.auth.signOut();
}
