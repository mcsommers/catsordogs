import { supabase } from './supabase';

export type ProfilePhoto = { position: number; storage_path: string; url?: string };

export type UserProfile = {
  userId: string;
  isSelf: boolean;
  firstName: string;
  age: number | null;
  city: string | null;
  distanceMiles: number | null;
  heightInches: number | null;
  gender: string | null;
  /** Only filled for your own profile; others never see it. */
  showGender: boolean | null;
  sexualOrientation: string[];
  showOrientation: boolean | null;
  occupation: string | null;
  school: string | null;
  aboutMe: string | null;
  languages: string[];
  interestedIn: string[];
  interests: string[];
  relationshipGoal: string | null;
  joinedAt: string;
  streakDays: number | null;
  followerCount: number | null;
  matchCount: number | null;
  profileViewCount: number | null;
  matchState: string;
  photos: ProfilePhoto[];
};

export type ProfileAnswer = {
  answerId: string;
  questionId: string;
  questionDate: string;
  questionText: string;
  captionText: string;
  durationSeconds: number;
  status: string;
  submittedAt: string;
  viewCount: number | null;
};

type ProfileRow = Record<string, unknown>;
type AnswerRow = Record<string, unknown>;

function mapProfile(row: ProfileRow): UserProfile {
  const photosRaw = row.photos;
  const photos: ProfilePhoto[] = Array.isArray(photosRaw)
    ? photosRaw.map((p) => {
        const o = p as Record<string, unknown>;
        return { position: Number(o.position), storage_path: String(o.storage_path) };
      })
    : [];
  return {
    userId: String(row.user_id),
    isSelf: Boolean(row.is_self),
    firstName: String(row.first_name ?? ''),
    age: row.age == null ? null : Number(row.age),
    city: row.city ? String(row.city) : null,
    distanceMiles: row.distance_miles == null ? null : Number(row.distance_miles),
    heightInches: row.height_inches == null ? null : Number(row.height_inches),
    gender: row.gender ? String(row.gender) : null,
    showGender: row.show_gender == null ? null : Boolean(row.show_gender),
    sexualOrientation: (row.sexual_orientation as string[]) ?? [],
    showOrientation: row.show_orientation == null ? null : Boolean(row.show_orientation),
    occupation: (() => {
      const job = row.job_title ? String(row.job_title) : '';
      const co = row.company ? String(row.company) : '';
      const merged = [job, co].filter(Boolean).join(' at ');
      return merged || null;
    })(),
    school: row.school ? String(row.school) : null,
    aboutMe: row.about_me ? String(row.about_me) : null,
    languages: (row.languages as string[]) ?? [],
    interestedIn: (row.interested_in as string[]) ?? [],
    interests: (row.interests as string[]) ?? [],
    relationshipGoal: row.relationship_goal ? String(row.relationship_goal) : null,
    joinedAt: String(row.joined_at),
    streakDays: row.streak_days == null ? null : Number(row.streak_days),
    followerCount: row.follower_count == null ? null : Number(row.follower_count),
    matchCount: row.match_count == null ? null : Number(row.match_count),
    profileViewCount: row.profile_view_count == null ? null : Number(row.profile_view_count),
    matchState: String(row.match_state ?? 'none'),
    photos: photos.sort((a, b) => a.position - b.position),
  };
}

function mapAnswer(row: AnswerRow): ProfileAnswer {
  return {
    answerId: String(row.answer_id),
    questionId: String(row.question_id),
    questionDate: String(row.question_date),
    questionText: String(row.question_text),
    captionText: String(row.caption_text ?? ''),
    durationSeconds: Number(row.duration_seconds) || 0,
    status: String(row.status),
    submittedAt: String(row.submitted_at),
    viewCount: row.view_count == null ? null : Number(row.view_count),
  };
}

export async function signPhotoPaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data, error } = await supabase.storage.from('profile-photos').createSignedUrls(paths, 3600);
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}

export async function attachPhotoUrls(photos: ProfilePhoto[]): Promise<ProfilePhoto[]> {
  const signed = await signPhotoPaths(photos.map((p) => p.storage_path));
  return photos.map((p) => ({ ...p, url: signed.get(p.storage_path) }));
}

export async function fetchUserProfile(userId?: string | null): Promise<UserProfile | null> {
  const { data, error } = await supabase.rpc('get_user_profile', { p_user_id: userId ?? null });
  if (error) throw error;
  const row = (data ?? [])[0] as ProfileRow | undefined;
  if (!row) return null;
  const profile = mapProfile(row);
  profile.photos = await attachPhotoUrls(profile.photos);
  return profile;
}

export async function recordProfileView(userId: string): Promise<void> {
  const { error } = await supabase.rpc('record_profile_view', { p_user_id: userId });
  if (error) throw error;
}

const ANSWER_PAGE = 15;

export async function fetchUserAnswersPage(
  userId: string | null | undefined,
  offset: number,
  limit = ANSWER_PAGE
): Promise<{ items: ProfileAnswer[]; totalCount: number }> {
  const { data, error } = await supabase.rpc('list_user_answers', {
    p_user_id: userId ?? null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  const rows = (data ?? []) as AnswerRow[];
  const items = rows.map(mapAnswer);
  const totalCount = rows[0]?.total_count != null ? Number(rows[0].total_count) : items.length;
  return { items, totalCount };
}

export const PROFILE_ANSWER_PAGE_SIZE = ANSWER_PAGE;
