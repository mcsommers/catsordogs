import { useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { scrollToFieldInScreen } from '../lib/formScroll';
import { loginFieldErrors, type CredentialField } from '../lib/validation';
import { describeAuthError } from '../lib/authErrors';
import { confirmationRedirect } from '../lib/authRedirects';
import {
  BackButton,
  ComingSoonSocialButtons,
  FormMessage,
  OrDivider,
  PrimaryButton,
  Screen,
  TextField,
  TextLink,
  TitleGroup,
  styles,
} from '../components/ui';
import { colors } from '../theme';

export default function LogIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CredentialField, string>>>({});
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const emailAnchorRef = useRef<View>(null);
  const passwordAnchorRef = useRef<View>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    setUnconfirmed(false);
    const errors = loginFieldErrors(email, password);
    const firstKey = errors.email ? 'email' : errors.password ? 'password' : null;
    if (firstKey) {
      setFieldErrors(errors);
      setProblem(errors[firstKey]!);
      if (firstKey === 'email') scrollToFieldInScreen(scrollRef, contentRef, emailAnchorRef);
      else scrollToFieldInScreen(scrollRef, contentRef, passwordAnchorRef);
      return;
    }
    setFieldErrors({});
    setProblem(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      const described = describeAuthError(error)!;
      setUnconfirmed(described.kind === 'email_not_confirmed');
      return setProblem(described.message);
    }
    router.replace('/');
  }

  async function resendConfirmation() {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: confirmationRedirect() },
    });
    if (error) return setProblem(describeAuthError(error)!.message);
    router.push({ pathname: '/check-email', params: { email: email.trim(), kind: 'signup', sent: '1' } });
  }

  return (
    <Screen scroll scrollRef={scrollRef} scrollContentRef={contentRef}>
      <View style={styles.header}>
        <BackButton />
      </View>
      <TitleGroup title="Welcome back" subtitle="Log in to answer today's question." />
      <ComingSoonSocialButtons />
      <OrDivider />
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
            returnKeyType="next"
            blurOnSubmit={false}
            value={email}
            error={!!fieldErrors.email}
            onChangeText={(t) => {
              setEmail(t);
              if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: undefined }));
            }}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </View>
        <View ref={passwordAnchorRef} collapsable={false}>
          <TextField
            ref={passwordRef}
            label="Password"
            icon={Lock}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            value={password}
            error={!!fieldErrors.password}
            onChangeText={(t) => {
              setPassword(t);
              if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
            }}
            onSubmitEditing={() => submit()}
          />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <TextLink
            label="Forgot password?"
            onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })}
          />
        </View>
        <FormMessage message={problem} />
        {unconfirmed ? (
          <TextLink label="Resend confirmation email" onPress={resendConfirmation} />
        ) : null}
      </View>
      <PrimaryButton label="Log In" onPress={submit} loading={busy} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
        <Text style={styles.hint}>New here?</Text>
        <TextLink label="Get Started" color={colors.textPrimary} size={12} onPress={() => router.replace('/sign-up')} />
      </View>
    </Screen>
  );
}
