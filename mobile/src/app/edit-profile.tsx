import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Briefcase, Cake, GraduationCap, MapPin, Ruler, User } from 'lucide-react-native';
import { attachPhotoUrls } from '../lib/profile';
import { pickAndAddGalleryPhoto } from '../lib/addGalleryPhoto';
import { MAX_GALLERY_PHOTOS, galleryPhotoCount } from '../lib/profilePhotos';
import {
  PROFILE_PHOTO_CONTENT_TYPE,
  PROFILE_PHOTO_EXT,
  profilePhotoPreviewUri,
  readProfilePhotoBytes,
} from '../lib/profilePhotoUpload';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { longDate, splitHeightInches, toIsoDate } from '../lib/format';
import { restoreScrollY, scrollToFieldInScreen } from '../lib/formScroll';
import {
  BIRTHDAY_ERROR,
  SAVE_ERROR,
  birthdayFieldProblem,
  firstProfileFinishIssue,
  parseHeightFtIn,
  profileSaveProblem,
  toggleChoice,
} from '../lib/profileForm';
import { DiscardProfileChangesDialog } from '../components/profile/DiscardProfileChangesDialog';
import {
  GenderSection,
  InterestsSection,
  OrientationSection,
  moreGenderOptions,
} from '../components/profile/ProfileChoiceSections';
import { setProfilePickerRequest } from '../lib/profilePicker';
import { ProfileBuildPhotos } from '../components/profile/ProfileBuildPhotos';
import { LocationField } from '../components/LocationField';
import { useProfileLeaveGuard } from '../hooks/useProfileLeaveGuard';
import {
  AppTextInput,
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
  show_gender: boolean;
  sexual_orientation: string[];
  show_orientation: boolean;
  height_feet: string;
  height_inches: string;
  city: string;
  occupation: string;
  school: string;
  about_me: string;
  interests: string[];
  interested_in: string[];
  relationship_goal: string | null;
};

const EMPTY: Form = {
  first_name: '',
  birthday: null,
  gender: null,
  show_gender: true,
  sexual_orientation: [],
  show_orientation: true,
  height_feet: '',
  height_inches: '',
  city: '',
  occupation: '',
  school: '',
  about_me: '',
  interests: [],
  interested_in: [],
  relationship_goal: null,
};

const ABOUT_MAX = 500;
type MultiField = 'interested_in';

export default function EditProfile() {
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
  const locationRef = useRef<View>(null);
  const occupationRef = useRef<View>(null);
  const morePhotosRef = useRef<View>(null);
  const schoolRef = useRef<View>(null);
  const aboutRef = useRef<View>(null);
  const addRowRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);

  const leaveProfile = useCallback(() => router.back(), []);
  const leaveGuard = useProfileLeaveGuard({
    ready: !loading,
    form,
    photos,
    onLeave: leaveProfile,
  });

  const loadPhotos = useCallback(async () => {
    const { data, error } = await supabase.from('profile_photos').select('id, position, storage_path').order('position');
    if (error) return setBanner(SAVE_ERROR);
    const rows = (data ?? []) as Photo[];
    try {
      const withUrls = rows.length ? await attachPhotoUrls(rows) : [];
      setPhotos(rows.map((row, i) => ({ ...row, url: withUrls[i]?.url })));
    } catch {
      setBanner(SAVE_ERROR);
    }
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
          show_gender: p.show_gender ?? true,
          sexual_orientation: (p.sexual_orientation ?? []).slice(0, 1),
          show_orientation: p.show_orientation ?? true,
          height_feet: p.height_inches != null ? String(splitHeightInches(p.height_inches).feet) : '',
          height_inches: p.height_inches != null ? String(splitHeightInches(p.height_inches).inches) : '',
          city: p.city ?? '',
          occupation: [p.job_title, p.company].filter(Boolean).join(' at ') || '',
          school: p.school ?? '',
          about_me: p.about_me ?? '',
          interests: p.interests ?? [],
          interested_in: p.interested_in ?? [],
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

  function openGenderMore() {
    setProfilePickerRequest({
      kind: 'gender',
      options: moreGenderOptions(choices('gender').map((o) => o.value)),
      value: form.gender,
      onDone: (value) => set('gender', value),
    });
    router.push('/profile-gender');
  }

  function openInterests() {
    setProfilePickerRequest({
      kind: 'interests',
      options: choices('interests').map((o) => o.value),
      value: form.interests,
      max: defs.interests?.max_selected ?? 5,
      onDone: (value) => set('interests', value),
    });
    router.push('/profile-interests');
  }

  function addCustom() {
    if (!adding) return;
    const value = customText.trim();
    if (value.length >= 1 && value.length <= 40 && !form[adding].includes(value)) toggle(adding, value);
    setAdding(null);
    setCustomText('');
  }

  async function addPhotoAt(position: number, aspect: [number, number]) {
    if (!userId || photos.some((p) => p.position === position)) return;
    if (position > 1 && galleryPhotoCount(photos) >= MAX_GALLERY_PHOTOS) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const restoreScrollYAfter = position > 1 ? scrollOffsetRef.current : null;
    Keyboard.dismiss();
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect,
      base64: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    setPhotoBusy(true);
    setBanner(null);
    const asset = picked.assets[0];
    const path = `${userId}/${Date.now()}.${PROFILE_PHOTO_EXT}`;
    const previewUri = profilePhotoPreviewUri(asset);
    setPhotos((prev) => [...prev, { id: `pending-${position}`, position, storage_path: path, url: previewUri }]);
    try {
      const bytes = await readProfilePhotoBytes(asset);
      const up = await supabase.storage
        .from('profile-photos')
        .upload(path, bytes, { contentType: PROFILE_PHOTO_CONTENT_TYPE, upsert: false });
      if (up.error) throw up.error;
      const ins = await supabase.from('profile_photos').insert({ user_id: userId, position, storage_path: path });
      if (ins.error) throw ins.error;
      await loadPhotos();
    } catch (e) {
      setPhotos((prev) => prev.filter((p) => p.storage_path !== path && p.id !== `pending-${position}`));
      setBanner(profileSaveProblem(e as Error, 'photo').banner);
    } finally {
      setPhotoBusy(false);
      if (restoreScrollYAfter != null) {
        restoreScrollY(scrollRef, restoreScrollYAfter);
      }
    }
  }

  function addAvatarPhoto() {
    void addPhotoAt(1, [1, 1]);
  }

  async function addMorePhoto() {
    if (!userId || photoBusy) return;
    setBanner(null);
    setPhotoBusy(true);
    try {
      const result = await pickAndAddGalleryPhoto(userId, photos);
      if (result.ok) setPhotos(result.photos);
      else if (!result.canceled) setBanner(result.banner);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(photo: Photo) {
    setBanner(null);
    if (String(photo.id).startsWith('pending-')) {
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      return;
    }
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

  async function saveChanges() {
    if (!userId) return;
    setBanner(null);
    setBirthdayError(false);
    setHeightError(false);
    const hasAvatar = photos.some((p) => p.position === 1);
    const issue = firstProfileFinishIssue({
      photoCount: hasAvatar ? 1 : 0,
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
          show_gender: form.show_gender,
          sexual_orientation: form.sexual_orientation,
          show_orientation: form.show_orientation,
          height_inches: height,
          city: form.city.trim() || null,
          job_title: form.occupation.trim() || null,
          company: null,
          school: form.school.trim() || null,
          about_me: form.about_me.trim() || null,
          interests: form.interests,
          interested_in: form.interested_in,
          relationship_goal: form.relationship_goal,
        })
        .eq('id', userId);
      problem = profileSaveProblem(details.error, 'details');
      if (problem.banner) return setBanner(problem.banner);

      if (form.city.trim() && form.city.trim() !== savedCity) {
        supabase.functions.invoke('update-location').catch(() => {});
      }
      leaveGuard.permitSavedNavigation();
      router.back();
    } catch {
      setBanner(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <CenteredSpinner />;

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
          <View ref={addRowRef} collapsable={false} style={styles.addRow}>
            <AppTextInput
              autoFocus
              value={customText}
              onChangeText={setCustomText}
              maxLength={40}
              style={styles.addInput}
              focusScrollAnchorRef={addRowRef}
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
    <Screen
      scroll
      scrollRef={scrollRef}
      scrollContentRef={contentRef}
      onScroll={(e) => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
      }}
    >
      <DiscardProfileChangesDialog
        visible={leaveGuard.discardVisible}
        onKeepEditing={leaveGuard.keepEditing}
        onLeave={leaveGuard.confirmLeave}
      />
      <BackButton onPress={leaveGuard.attemptLeave} />
      <TitleGroup title="Edit profile" subtitle="Update your profile photo and details." />
      {banner ? <ErrorBanner message={banner} /> : null}

      <View ref={photosRef} collapsable={false}>
        <ProfileBuildPhotos
          section="avatar"
          photos={photos}
          photoBusy={photoBusy}
          onAddAvatar={addAvatarPhoto}
          onAddMore={addMorePhoto}
          onRemove={removePhoto}
        />
      </View>

      <View style={{ gap: 16 }}>
        <View ref={firstNameRef} collapsable={false}>
          <TextField
            label="First Name"
            icon={User}
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

      <View ref={genderRef} collapsable={false}>
        <GenderSection
          allOptions={choices('gender').map((o) => o.value)}
          value={form.gender}
          show={form.show_gender}
          onSelect={(v) => set('gender', v)}
          onShowChange={(v) => set('show_gender', v)}
          onOpenMore={openGenderMore}
        />
      </View>

      <View style={{ gap: 16 }}>
        <View ref={heightRef} collapsable={false} style={{ gap: 6 }}>
          <FieldLabelRow label="Height" requirement="optional" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Feet"
                icon={Ruler}
                keyboardType="number-pad"
                value={form.height_feet}
                onChangeText={(t) => {
                  setHeightError(false);
                  set('height_feet', t.replace(/[^0-9]/g, ''));
                }}
                maxLength={1}
                error={heightError}
                focusScrollAnchorRef={heightRef}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Inches"
                icon={Ruler}
                keyboardType="number-pad"
                value={form.height_inches}
                onChangeText={(t) => {
                  setHeightError(false);
                  set('height_inches', t.replace(/[^0-9]/g, ''));
                }}
                maxLength={2}
                error={heightError}
                focusScrollAnchorRef={heightRef}
              />
            </View>
          </View>
        </View>
        <View ref={locationRef} collapsable={false}>
          <LocationField
            label="Location"
            icon={MapPin}
            requirement="optional"
            value={form.city}
            onChangeText={(t) => set('city', t)}
            focusScrollAnchorRef={locationRef}
          />
        </View>
      </View>
      <View ref={occupationRef} collapsable={false}>
        <TextField
          label="Occupation"
          icon={Briefcase}
          requirement="optional"
          value={form.occupation}
          onChangeText={(t) => set('occupation', t)}
          maxLength={100}
        />
      </View>
      <View ref={schoolRef} collapsable={false}>
        <TextField
          label="School"
          icon={GraduationCap}
          requirement="optional"
          value={form.school}
          onChangeText={(t) => set('school', t)}
          maxLength={100}
        />
      </View>

      <View ref={aboutRef} collapsable={false} style={{ gap: 6 }}>
        <FieldLabelRow label="About Me" requirement="optional" />
        <AppTextInput
          multiline
          accessibilityLabel="About Me"
          value={form.about_me}
          onChangeText={(t) => set('about_me', t)}
          focusScrollAnchorRef={aboutRef}
          maxLength={ABOUT_MAX}
          style={styles.bio}
          textAlignVertical="top"
        />
        <Text style={[ui.hint, { textAlign: 'right' }]}>{`${form.about_me.length} / ${ABOUT_MAX}`}</Text>
      </View>

      <OrientationSection
        options={choices('sexual_orientation').map((o) => o.value)}
        value={form.sexual_orientation}
        show={form.show_orientation}
        onChange={(v) => set('sexual_orientation', v)}
        onShowChange={(v) => set('show_orientation', v)}
      />
      {multiSection('interested_in', 'Interested in', 'Select all that apply')}
      {defs.interests ? <InterestsSection value={form.interests} onOpen={openInterests} /> : null}

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

      <View ref={morePhotosRef} collapsable={false}>
        <ProfileBuildPhotos
          section="more"
          photos={photos}
          photoBusy={photoBusy}
          onAddAvatar={addAvatarPhoto}
          onAddMore={addMorePhoto}
          onRemove={removePhoto}
        />
      </View>

      <PrimaryButton
        label="Save Changes"
        onPress={saveChanges}
        loading={saving}
        disabled={!photos.some((p) => p.position === 1) || photoBusy}
      />

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
