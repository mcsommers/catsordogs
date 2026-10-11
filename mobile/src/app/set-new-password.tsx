import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { MIN_PASSWORD_LENGTH } from '../lib/validation';
import { describeAuthError } from '../lib/authErrors';
import { useSession } from '../lib/session';
import { scrollToFieldInScreen } from '../lib/formScroll';
import { BackButton, FormMessage, PrimaryButton, Screen, TextField, TitleGroup, styles } from '../components/ui';

export default function SetNewPassword() {
  const { session, clearRecovering } = useSession();
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const passwordAnchorRef = useRef<View>(null);

  async function save() {
    if (!session) return setProblem('This reset link has expired. Ask for a new one from Log In.');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(true);
      setProblem(`Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      scrollToFieldInScreen(scrollRef, contentRef, passwordAnchorRef);
      return;
    }
    setPasswordError(false);
    setProblem(null);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setProblem(describeAuthError(error)!.message);
    clearRecovering();
    router.replace('/');
  }

  return (
    <Screen scroll scrollRef={scrollRef} scrollContentRef={contentRef}>
      <View style={styles.header}>
        <BackButton onPress={() => router.replace('/')} />
      </View>
      <TitleGroup
        title="Set a new password"
        subtitle="Pick a new password for your account. You'll stay logged in on this phone."
      />
      <View style={{ gap: 16 }}>
        <View ref={passwordAnchorRef} collapsable={false}>
          <TextField
            label="New password"
            icon={Lock}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            error={passwordError}
            onChangeText={(t) => {
              setPassword(t);
              setPasswordError(false);
            }}
          />
        </View>
        <Text style={styles.hint}>At least 8 characters.</Text>
        <FormMessage message={problem} />
      </View>
      <PrimaryButton label="Save Password" onPress={save} loading={busy} />
    </Screen>
  );
}
