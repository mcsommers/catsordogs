import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { describeAuthError } from '../lib/authErrors';
import { confirmationRedirect, resetRedirect } from '../lib/authRedirects';
import { BackButton, FormMessage, PrimaryButton, Screen, TextLink, TitleGroup, styles as ui } from '../components/ui';
import { colors } from '../theme';

/** Shown after Sign Up (kind=signup) and after Forgot Password (kind=reset). */
export default function CheckEmail() {
  const { email = '', kind = 'signup', sent } = useLocalSearchParams<{ email?: string; kind?: string; sent?: string }>();
  const [note, setNote] = useState<{ text: string; tone: 'error' | 'info' } | null>(
    sent === '1' ? { text: 'Sent. Check your inbox.', tone: 'info' } : null
  );
  const [busy, setBusy] = useState(false);

  async function sendAgain() {
    setBusy(true);
    const { error } =
      kind === 'reset'
        ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetRedirect() })
        : await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: confirmationRedirect() } });
    setBusy(false);
    setNote(error ? { text: describeAuthError(error)!.message, tone: 'error' } : { text: 'Sent. Check your inbox.', tone: 'info' });
  }

  return (
    <Screen scroll>
      <View style={ui.header}>
        <BackButton onPress={() => router.replace('/log-in')} />
      </View>
      <View style={styles.badge}>
        <MailCheck size={32} color={colors.accentCat} />
      </View>
      <TitleGroup
        title="Check your email"
        subtitle={`We sent a link to ${email || 'your email'}. Open it on this phone to continue. The link works once.`}
      />
      <PrimaryButton label="Back to Log In" onPress={() => router.replace('/log-in')} />
      <TextLink label={busy ? 'Sending…' : "Didn't get it? Resend email"} onPress={() => !busy && sendAgain()} />
      <FormMessage message={note?.text ?? null} tone={note?.tone} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentCatTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
