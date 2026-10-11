import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Briefcase,
  Building2,
  Cake,
  GraduationCap,
  ImagePlus,
  MapPin,
  Plus,
  Ruler,
  User,
  X,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { longDate, splitHeightInches, toIsoDate } from '../lib/format';
import { scrollToFieldInScreen } from '../lib/formScroll';
import {
  BIRTHDAY_ERROR,
  SAVE_ERROR,
  birthdayFieldProblem,
  firstProfileFinishIssue,
  parseHeightFtIn,
  profileSaveProblem,
  toggleChoice,
} from '../lib/profileForm';
import { LocationField } from '../components/LocationField';
import {
  BackButton,
  CenteredSpinner,
  Chip,
  ErrorBanner,
  FieldLabelRow,
  PressableField,
  PrimaryButton,
  Screen,
  SectionHeader,
  SelectRow,
  TextField,
  TitleGroup,
  styles as ui,
} from '../components/ui';
import { colors, fonts } from '../theme';

type Option = { category: string; value: string; description: string | null };
type FieldDef = { field: string; label: string; kind: 'single' | 'multi'; option_category: string; allow_custom: boolean; max_selected: number | null };
type Photo = { id: string; position: number; storage_path: string; url?: string };

type Form = {
  first_name: string;
  birthday: string | null;
  gender: string | null;
  pronouns: string[];
  sexual_orientation: string[];
  height_feet: string;
  height_inches: string;
  city: string;
  job_title: string;
  company: string;
  school: string;
  about_me: string;
  lifestyle_tags: string[];
  languages: string[];
  interests: string[];
  relationship_goal: string | null;
};

const EMPTY: Form = {
  first_name: '',
  birthday: null,
  gender: null,
  pronouns: [],
  sexual_orientation: [],
  height_feet: '',
  height_inches: '',
  city: '',
  job_title: '',
  company: '',
  school: '',
  about_me: '',
  lifestyle_tags: [],
  languages: [],
  interests: [],
  relationship_goal: null,
};

const ABOUT_MAX = 500;
const MAX_PHOTOS = 6;
const PROFILE_SUBTITLE =
  'Required: at least one photo, first name, birthday, and gender. Everything else is optional.';

type MultiField = 'pronouns' | 'sexual_orientation' | 'lifestyle_tags' | 'languages' | 'interests';

export default function BuildProfile() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(EMPTY);
  const [savedCity, setSavedCity] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [defs, setDefs] = useState<Record<string, FieldDef>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pickingBirthday, setPickingBirthday] = useState(false);
  const [adding, setAdding] = useState<MultiField | null>(null);
  const [customText, setCustomText] = useState('');
  const [birthdayError, setBirthdayError] = useState(false);
  const [heightError, setHeightError] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const photosRef = useRef<View>(null);
  const firstNameRef = useRef<View>(null);
  const birthdayRef = useRef<View>(null);
  const genderRef = useRef<View>(null);
  const heightRef = useRef<View>(null);

  const loadPhotos = useCallback(async () => {
    const { data, error } = await supabase.from('profile_photos').select('id, position, storage_path').order('position');
    if (error) return setBanner(SAVE_ERROR);
    const rows = (data ?? []) as Photo[];
    if (rows.length) {
      const signed = await supabase.storage.from('profile-photos').createSignedUrls(rows.map((r) => r.storage_path), 3600);
      rows.forEach((r, i) => (r.url = signed.data?.[i]?.signedUrl ?? undefined));
    }
    setPhotos(rows);
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [profile, opts, fieldDefs] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('profile_options').select('category, value, description').eq('active', true).order('sort_order'),
        supabase.from('profile_field_defs').select('field, label, kind, option_category, allow_custom, max_selected').eq('active', true),
      ]);
      if (profile.error || opts.error || fieldDefs.error) setBanner(SAVE_ERROR);
      const p = profile.data;
      if (p) {
        setForm({
          first_name: p.first_name ?? '',
          birthday: p.birthday,
          gender: p.gender,
          pronouns: p.pronouns ?? [],
          sexual_orientation: p.sexual_orientation ?? [],
          height_feet: p.height_inches != null ? String(splitHeightInches(p.height_inches).feet) : '',
          height_inches: p.height_inches != null ? String(splitHeightInches(p.height_inches).inches) : '',
          city: p.city ?? '',
          job_title: p.job_title ?? '',
          company: p.company ?? '',
          school: p.school ?? '',
          about_me: p.about_me ?? '',
          lifestyle_tags: p.lifestyle_tags ?? [],
          languages: p.languages ?? [],
          interests: p.interests ?? [],
          relationship_goal: p.relationship_goal,
        });
        setSavedCity(p.city ?? '');
      }
      setOptions((opts.data ?? []) as Option[]);
      setDefs(Object.fromEntries(((fieldDefs.data ?? []) as FieldDef[]).map((d) => [d.field, d])));
      await loadPhotos();
      setLoading(false);
    })();
  }, [userId, loadPhotos]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const choices = (field: string) => options.filter((o) => o.category === defs[field]?.option_category);

  function toggle(field: MultiField, value: string) {
    set(field, toggleChoice(form[field], value, defs[field]?.max_selected ?? null));
  }

  function addCustom() {
    if (!adding) return;
    const value = customText.trim();
    if (value.length >= 1 && value.length <= 40 && !form[adding].includes(value)) toggle(adding, value);
    setAdding(null);
    setCustomText('');
  }

  async function addPhoto() {
    if (!userId || photos.length >= MAX_PHOTOS) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 5] });
    if (picked.canceled) return;
    setPhotoBusy(true);
    setBanner(null);
    const asset = picked.assets[0];
    const used = new Set(photos.map((p) => p.position));
    const position = [1, 2, 3, 4, 5, 6].find((n) => !used.has(n))!;
    const ext = asset.mimeType === 'image/png' ? 'png' : 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    try {
      const bytes = await (await fetch(asset.uri)).arrayBuffer();
      const up = await supabase.storage.from('profile-photos').upload(path, bytes, { contentType: asset.mimeType ?? 'image/jpeg' });
      if (up.error) throw up.error;
      const ins = await supabase.from('profile_photos').insert({ user_id: userId, position, storage_path: path });
      if (ins.error) throw ins.error;
      await loadPhotos();
    } catch (e) {
      setBanner(profileSaveProblem(e as Error, 'photo').banner);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(photo: Photo) {
    setBanner(null);
    const { error } = await supabase.from('profile_photos').delete().eq('id', photo.id);
    if (error) return setBanner(profileSaveProblem(error, 'photo').banner);
    await supabase.storage.from('profile-photos').remove([photo.storage_path]);
    await loadPhotos();
  }

  function scrollToFinishField(field: 'photos' | 'first_name' | 'birthday' | 'gender' | 'height') {
    const map = {
      photos: photosRef,
      first_name: firstNameRef,
      birthday: birthdayRef,
      gender: genderRef,
      height: heightRef,
    };
    scrollToFieldInScreen(scrollRef, contentRef, map[field]);
  }

  async function finish() {
    if (!userId) return;
    setBanner(null);
    setBirthdayError(false);
    setHeightError(false);
    const issue = firstProfileFinishIssue({
      photoCount: photos.length,
      firstName: form.first_name,
      birthday: form.birthday,
      gender: form.gender,
      heightFeet: form.height_feet,
      heightInches: form.height_inches,
    });
    if (issue) {
      setBirthdayError(issue.birthdayError);
      setHeightError(issue.heightError);
      setBanner(issue.banner);
      scrollToFinishField(issue.field);
      return;
    }
    const height = parseHeightFtIn(form.height_feet, form.height_inches);

    setSaving(true);
    try {
      // Birthday is saved on its own so a refusal (under 18) can be shown on the Birthday field.
      const bday = await supabase.from('profiles').update({ birthday: form.birthday }).eq('id', userId);
      let problem = profileSaveProblem(bday.error, 'birthday');
      if (problem.field || problem.banner) {
        setBirthdayError(problem.field === 'birthday');
        if (problem.field === 'birthday') scrollToFinishField('birthday');
        return setBanner(problem.banner);
      }
      const details = await supabase
        .from('profiles')
        .update({
          first_name: form.first_name.trim(),
          gender: form.gender,
          pronouns: form.pronouns,
          sexual_orientation: form.sexual_orientation,
          height_inches: height,
          city: form.city.trim() || null,
          job_title: form.job_title.trim() || null,
          company: form.company.trim() || null,
          school: form.school.trim() || null,
          about_me: form.about_me.trim() || null,
          lifestyle_tags: form.lifestyle_tags,
          languages: form.languages,
          interests: form.interests,
          relationship_goal: form.relationship_goal,
        })
        .eq('id', userId);
      problem = profileSaveProblem(details.error, 'details');
      if (problem.banner) return setBanner(problem.banner);

      const done = await supabase.rpc('complete_profile');
      problem = profileSaveProblem(done.error, 'finish');
      if (problem.banner) return setBanner(problem.banner);

      if (form.city.trim() && form.city.trim() !== savedCity) {
        // Looks up the city for distance. Not needed to continue, so a failure is ignored.
        supabase.functions.invoke('update-location').catch(() => {});
      }
      router.replace('/how-it-works');
    } catch {
      setBanner(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <CenteredSpinner />;

  const interestsMax = defs.interests?.max_selected ?? null;
  const multiSection = (field: MultiField, title: string, helper?: string) => {
    const def = defs[field];
    if (!def) return null;
    const known = choices(field).map((o) => o.value);
    const custom = form[field].filter((v) => !known.includes(v));
    return (
      <View style={{ gap: 12 }}>
        <SectionHeader title={title} helper={helper} requirement="optional" />
        <View style={styles.chips}>
          {[...known, ...custom].map((v) => (
            <Chip key={v} label={v} selected={form[field].includes(v)} onPress={() => toggle(field, v)} />
          ))}
          {def.allow_custom ? <Chip label="+ Add" selected={false} onPress={() => setAdding(field)} /> : null}
        </View>
        {adding === field ? (
          <View style={styles.addRow}>
            <TextInput
              autoFocus
              value={customText}
              onChangeText={setCustomText}
              maxLength={40}
              placeholder={`Add your own (${def.label.toLowerCase()})`}
              placeholderTextColor={colors.textSecondary}
              style={styles.addInput}
              onSubmitEditing={addCustom}
              returnKeyType="done"
            />
            <Pressable accessibilityRole="button" onPress={addCustom} style={styles.addButton}>
              <Text style={styles.addButtonLabel}>Add</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen scroll scrollRef={scrollRef} scrollContentRef={contentRef}>
      <View style={ui.header}>
        <BackButton onPress={() => supabase.auth.signOut().then(() => router.replace('/welcome'))} />
        <Text style={ui.step}>Step 2 of 2</Text>
      </View>
      <TitleGroup title="Build your profile" subtitle={PROFILE_SUBTITLE} />
      {banner ? <ErrorBanner message={banner} /> : null}

      <View ref={photosRef} collapsable={false} style={{ gap: 10 }}>
        <SectionHeader title="Photos" requirement="required" />
        {[0, 1].map((row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 10 }}>
            {[0, 1, 2].map((col) => {
              const index = row * 3 + col;
              const photo = photos[index];
              if (photo) {
                return (
                  <View key={index} style={styles.tile}>
                    {photo.url ? <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} /> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                      onPress={() => removePhoto(photo)}
                      style={styles.removePhoto}
                      hitSlop={8}
                    >
                      <X size={14} color={colors.white} />
                    </Pressable>
                  </View>
                );
              }
              const first = index === photos.length;
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel="Add a photo"
                  onPress={addPhoto}
                  disabled={photoBusy}
                  style={[styles.tile, styles.emptyTile, first && styles.primaryTile]}
                >
                  {first ? <ImagePlus size={26} color={colors.accentDog} /> : <Plus size={22} color={colors.textSecondary} />}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ gap: 16 }}>
        <View ref={firstNameRef} collapsable={false}>
          <TextField
            label="First Name"
            icon={User}
            placeholder="Alex"
            requirement="required"
            value={form.first_name}
            onChangeText={(t) => set('first_name', t)}
            maxLength={50}
            autoComplete="given-name"
          />
        </View>
        <View ref={birthdayRef} collapsable={false}>
          <PressableField
            label="Birthday"
            icon={Cake}
            requirement="required"
            value={form.birthday ? longDate(form.birthday) : null}
            placeholder="January 1, 2000"
            onPress={() => setPickingBirthday(true)}
            error={birthdayError}
          />
          <Text style={[ui.hint, birthdayError && { color: colors.danger, fontFamily: fonts.bodySemi }]}>
            {birthdayError
              ? form.birthday
                ? birthdayFieldProblem(form.birthday) ?? BIRTHDAY_ERROR
                : BIRTHDAY_ERROR
              : 'You must be 18 or older to use Cats or Dogs?'}
          </Text>
        </View>
      </View>

      <View ref={genderRef} collapsable={false} style={{ gap: 12 }}>
        <SectionHeader title="Gender" requirement="required" />
        <View style={styles.chips}>
          {choices('gender').map((o) => (
            <Chip key={o.value} label={o.value} selected={form.gender === o.value} onPress={() => set('gender', o.value)} />
          ))}
        </View>
      </View>
      {multiSection('pronouns', 'Pronouns')}
      {multiSection('sexual_orientation', 'Sexual Orientation', 'Select all that apply')}

      <View style={{ gap: 16 }}>
        <View ref={heightRef} collapsable={false} style={{ gap: 6 }}>
          <FieldLabelRow label="Height" requirement="optional" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Feet"
                icon={Ruler}
                placeholder="5"
                keyboardType="number-pad"
                value={form.height_feet}
                onChangeText={(t) => {
                  setHeightError(false);
                  set('height_feet', t.replace(/[^0-9]/g, ''));
                }}
                maxLength={1}
                error={heightError}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Inches"
                icon={Ruler}
                placeholder="9"
                keyboardType="number-pad"
                value={form.height_inches}
                onChangeText={(t) => {
                  setHeightError(false);
                  set('height_inches', t.replace(/[^0-9]/g, ''));
                }}
                maxLength={2}
                error={heightError}
              />
            </View>
          </View>
        </View>
        <LocationField
          label="Location"
          icon={MapPin}
          requirement="optional"
          value={form.city}
          onChangeText={(t) => set('city', t)}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Job Title"
            icon={Briefcase}
            requirement="optional"
            placeholder="Product Designer"
            value={form.job_title}
            onChangeText={(t) => set('job_title', t)}
            maxLength={100}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Company"
            icon={Building2}
            requirement="optional"
            placeholder="Acme Co."
            value={form.company}
            onChangeText={(t) => set('company', t)}
            maxLength={100}
          />
        </View>
      </View>
      <TextField
        label="School"
        icon={GraduationCap}
        requirement="optional"
        placeholder="University of Michigan"
        value={form.school}
        onChangeText={(t) => set('school', t)}
        maxLength={100}
      />

      <View style={{ gap: 6 }}>
        <FieldLabelRow label="About Me" requirement="optional" />
        <TextInput
          multiline
          accessibilityLabel="About Me"
          value={form.about_me}
          onChangeText={(t) => set('about_me', t)}
          maxLength={ABOUT_MAX}
          placeholder="Tell people about yourself — your pets, hobbies, what you're looking for..."
          placeholderTextColor={colors.textSecondary}
          style={styles.bio}
          textAlignVertical="top"
        />
        <Text style={[ui.hint, { textAlign: 'right' }]}>{`${form.about_me.length} / ${ABOUT_MAX}`}</Text>
      </View>

      {multiSection('lifestyle_tags', 'Lifestyle')}
      {multiSection('languages', 'Languages')}
      {multiSection('interests', 'Interests', interestsMax ? `${form.interests.length} of ${interestsMax} selected` : undefined)}

      <View style={{ gap: 12 }}>
        <SectionHeader title="Relationship Goals" requirement="optional" />
        {choices('relationship_goal').map((o) => (
          <SelectRow
            key={o.value}
            title={o.value}
            subtitle={o.description}
            selected={form.relationship_goal === o.value}
            onPress={() => set('relationship_goal', form.relationship_goal === o.value ? null : o.value)}
          />
        ))}
      </View>

      <PrimaryButton label="Finish Setup" onPress={finish} loading={saving} disabled={!photos.length || photoBusy} />

      {pickingBirthday ? (
        <BirthdayPicker
          value={form.birthday}
          onDone={(iso) => {
            setPickingBirthday(false);
            if (iso) {
              set('birthday', iso);
              setBirthdayError(!!birthdayFieldProblem(iso));
            }
          }}
        />
      ) : null}
    </Screen>
  );
}

function BirthdayPicker({ value, onDone }: { value: string | null; onDone: (iso: string | null) => void }) {
  const initial = value ? new Date(`${value}T12:00:00`) : new Date(2000, 0, 1);
  const [picked, setPicked] = useState(initial);
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={initial}
        mode="date"
        maximumDate={new Date()}
        onValueChange={(_event, date) => onDone(toIsoDate(date))}
        onDismiss={() => onDone(null)}
      />
    );
  }
  return (
    <Modal transparent animationType="slide" onRequestClose={() => onDone(null)}>
      <View style={styles.sheetScrim}>
        <View style={styles.sheet}>
          <DateTimePicker
            value={picked}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            onValueChange={(_event, date) => setPicked(date)}
            textColor={colors.textPrimary}
          />
          <PrimaryButton label="Done" onPress={() => onDone(toIsoDate(picked))} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flex: 1, height: 112, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface },
  emptyTile: { borderWidth: 1.5, borderColor: colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  primaryTile: { backgroundColor: colors.accentDogTint, borderWidth: 0 },
  removePhoto: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bio: {
    minHeight: 112,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  addButton: { backgroundColor: colors.accentDog, borderRadius: 9999, paddingHorizontal: 18, paddingVertical: 10 },
  addButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  sheetScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  sheet: { backgroundColor: colors.bg, padding: 20, paddingBottom: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 },
});
