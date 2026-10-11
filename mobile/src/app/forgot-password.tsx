import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { isValidEmail } from '../lib/validation';
import { describeAuthError, isNetworkError } from '../lib/authErrors';
import { resetRedirect } from '../lib/authRedirects';
import { scrollToFieldInScreen } from '../lib/formScroll';
import { BackButton, FormMessage, PrimaryButton, Screen, TextField, TextLink, TitleGroup, styles } from '../components/ui';
import { colors } from '../theme';

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const emailAnchorRef = useRef<View>(null);

  async function submit() {
    if (!isValidEmail(email)) {
      setEmailError(true);
      setProblem('Enter a valid email address.');
      scrollToFieldInScreen(scrollRef, contentRef, emailAnchorRef);
      return;
    }
    setEmailError(false);
    setProblem(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: resetRedirect() });
    setBusy(false);
    // The same screen follows whether or not the email has an account, so this
    // form can't be used to find out who has signed up.
    if (error && (error.status === 429 || isNetworkError(error))) {
      return setProblem(describeAuthError(error)!.message);
    }
    router.replace({ pathname: '/check-email', params: { email: email.trim(), kind: 'reset' } });
  }

  return (
    <Screen scroll scrollRef={scrollRef} scrollContentRef={contentRef}>
      <View style={styles.header}>
        <BackButton />
      </View>
      <TitleGroup
        title="Reset your password"
        subtitle="Enter the email you signed up with. We'll send you a link to set a new password."
      />
      <View style={{ gap: 16 }}>
        <View ref={emailAnchorRef} collapsable={false}>
          <TextField
            label="Email"
            icon={Mail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            error={emailError}
            onChangeText={(t) => {
              setEmail(t);
              setEmailError(false);
            }}
          />
        </View>
        <FormMessage message={problem} />
      </View>
      <PrimaryButton label="Send Reset Link" onPress={submit} loading={busy} />
      <TextLink label="Back to Log In" color={colors.textPrimary} size={12} onPress={() => router.replace('/log-in')} />
    </Screen>
  );
}
