import { useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { scrollToFieldInScreen } from '../lib/formScroll';
import { credentialFieldErrors, type CredentialField } from '../lib/validation';
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
  TitleGroup,
  styles,
} from '../components/ui';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CredentialField, string>>>({});
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const emailAnchorRef = useRef<View>(null);
  const passwordAnchorRef = useRef<View>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    const errors = credentialFieldErrors(email, password);
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
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: confirmationRedirect() },
    });
    setBusy(false);
    if (error) return setProblem(describeAuthError(error)!.message);
    router.push({ pathname: '/check-email', params: { email: email.trim(), kind: 'signup' } });
  }

  return (
    <Screen scroll scrollRef={scrollRef} scrollContentRef={contentRef}>
      <View style={styles.headerWithTitle}>
        <BackButton />
        <Text style={styles.headerTitle}>Create your account</Text>
      </View>
      <TitleGroup subtitle="Let's make some magic." />
      <ComingSoonSocialButtons />
      <OrDivider />
      <View style={{ gap: 16 }}>
        <View ref={emailAnchorRef} collapsable={false}>
          <TextField
            label="Email"
            icon={Mail}
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
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
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
        <Text style={styles.hint}>At least 8 characters.</Text>
        <FormMessage message={problem} />
      </View>
      <PrimaryButton label="Continue" onPress={submit} loading={busy} />
      <Text style={[styles.hint, { textAlign: 'center' }]}>By continuing, you agree to our Terms &amp; Privacy Policy</Text>
    </Screen>
  );
}
