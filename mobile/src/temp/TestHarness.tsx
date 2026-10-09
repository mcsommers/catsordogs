// TEMPORARY plain screen for checking Phases 1-3 work on a real device or simulator.
// It is replaced by the designed screens (01 Welcome, 02 Sign Up, 03 Build Profile) in Phase A.
// Until then, the email confirmation link signs the person in and lands on this profile form,
// which is the stand-in for screen 03.
import { useCallback, useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { parseBirthdayInput } from '../lib/dates';
import VideoTest from './VideoTest';

export default function TestHarness() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [genders, setGenders] = useState<string[]>([]);
  const [profile, setProfile] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [questionInfo, setQuestionInfo] = useState<unknown>(null);

  const say = (m: string) => setMessage(m);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').maybeSingle();
    setProfile(data);
    const { data: opts } = await supabase
      .from('profile_options')
      .select('value')
      .eq('category', 'gender')
      .order('sort_order');
    setGenders((opts ?? []).map((o) => o.value));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function finishEmailLink(url: string) {
      const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
      const hash = url.includes('#') ? url.split('#')[1] : '';
      const params = new URLSearchParams(hash || query);
      const code = params.get('code');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        say(error ? error.message : 'Email confirmed. You are signed in.');
        return;
      }
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        say(error ? error.message : 'Email confirmed. You are signed in.');
      }
    }
    Linking.getInitialURL().then((url) => { if (url) finishEmailLink(url); });
    const sub = Linking.addEventListener('url', ({ url }) => finishEmailLink(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (session) refresh();
    else setProfile(null);
  }, [session, refresh]);

  async function signUp() {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: Linking.createURL('auth-callback') },
    });
    if (error) return say(error.message);
    if (data.session) return say('Signed up.');
    say('Check your email and tap the link. It opens the app, signs you in, and brings you here to build your profile.');
  }
  async function logIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    say(error ? error.message : 'Logged in.');
  }
  async function saveProfile() {
    const bd = parseBirthdayInput(birthday);
    if (!bd) return say('Birthday must look like 2000-01-31.');
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: firstName, birthday: bd, gender })
      .eq('id', session!.user.id);
    say(error ? error.message : 'Profile saved.');
    refresh();
  }
  async function addPhoto() {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    const uid = session!.user.id;
    const path = `${uid}/${Date.now()}.jpg`;
    const bytes = await (await fetch(asset.uri)).arrayBuffer();
    const up = await supabase.storage.from('profile-photos').upload(path, bytes, { contentType: asset.mimeType ?? 'image/jpeg' });
    if (up.error) return say(up.error.message);
    const { count } = await supabase.from('profile_photos').select('*', { count: 'exact', head: true });
    const ins = await supabase.from('profile_photos').insert({ user_id: uid, position: (count ?? 0) + 1, storage_path: path });
    say(ins.error ? ins.error.message : 'Photo added.');
  }
  async function finish() {
    const { error } = await supabase.rpc('complete_profile');
    say(error ? error.message : 'Profile finished.');
    refresh();
  }
  async function saveSampleFilters() {
    const { error } = await supabase
      .from('filter_preferences')
      .update({ filters: { show_me: 'Everyone', age_range: { min: 24, max: 35 } } })
      .eq('user_id', session!.user.id);
    say(error ? error.message : 'Sample filters saved.');
  }

  async function loadQuestion() {
    const today = await supabase.rpc('get_todays_question');
    const onboarding = await supabase.rpc('get_onboarding_question');
    const config = await supabase.rpc('get_app_config');
    const err = today.error ?? onboarding.error ?? config.error;
    if (err) return say(err.message);
    setQuestionInfo({ today: today.data, onboarding: onboarding.data, config: config.data });
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Phase 1-3 test screen (temporary)</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {!session ? (
        <View style={styles.block}>
          <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} placeholder="Password (8+ characters)" secureTextEntry value={password} onChangeText={setPassword} />
          <Button title="Sign up" onPress={signUp} />
          <Button title="Log in" onPress={logIn} />
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.title}>
            {profile && typeof profile === 'object' && 'profile_completed_at' in profile && profile.profile_completed_at
              ? 'Signed in'
              : 'Build your profile'}
          </Text>
          <Text>Signed in as {session.user.email}</Text>
          <Text style={styles.note}>
            Temporary stand-in for screen 03 Build Profile. The designed screen arrives with the phone-app phase.
          </Text>
          <TextInput style={styles.input} placeholder="First name" value={firstName} onChangeText={setFirstName} />
          <TextInput style={styles.input} placeholder="Birthday (YYYY-MM-DD)" value={birthday} onChangeText={setBirthday} />
          <View style={styles.row}>
            {genders.map((g) => (
              <Button key={g} title={g === gender ? `✓ ${g}` : g} onPress={() => setGender(g)} />
            ))}
          </View>
          <Button title="Save profile" onPress={saveProfile} />
          <Button title="Add a photo" onPress={addPhoto} />
          <Button title="Finish setup" onPress={finish} />
          <Button title="Save sample filters" onPress={saveSampleFilters} />
          <Button title="Load today's question + settings" onPress={loadQuestion} />
          <Text style={styles.json}>{questionInfo ? JSON.stringify(questionInfo, null, 2) : ''}</Text>
          <VideoTest />
          <Button title="Log out" onPress={() => supabase.auth.signOut()} />
          <Text style={styles.json}>{JSON.stringify(profile, null, 2)}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, paddingTop: 64, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  message: { color: '#8B3FC7' },
  block: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  json: { fontFamily: 'Courier', fontSize: 11 },
  note: { color: '#57534e' },
});
