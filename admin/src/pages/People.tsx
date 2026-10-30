import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { formatWhen } from '../dates';
import { useAuth } from '../auth';
import {
  describeFilterLines,
  describeRankingLines,
  mapFilterDefinition,
  specificInterestsSummary,
  type AdminPersonFeedSettings,
  type FilterDefinition,
} from '../feedSettingsDisplay';

type Photo = { position: number; storage_path: string };
type Person = {
  id: string;
  email: string | null;
  first_name: string | null;
  birthday: string | null;
  age: number | null;
  gender: string | null;
  sexual_orientation: string[];
  interested_in: string[];
  height_inches: number | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  job_title: string | null;
  company: string | null;
  school: string | null;
  about_me: string | null;
  lifestyle_tags: string[];
  languages: string[];
  interests: string[];
  relationship_goal: string | null;
  allow_followers: boolean;
  profile_completed_at: string | null;
  time_zone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  follower_count: number;
  following_count: number;
  match_count: number;
  answer_count: number;
  photos: Photo[];
};

type SortKey =
  | 'photo'
  | 'first_name'
  | 'email'
  | 'follower_count'
  | 'following_count'
  | 'match_count'
  | 'answer_count'
  | 'created_at'
  | 'last_sign_in_at';

const columns: { key: SortKey; label: string; align?: 'num' }[] = [
  { key: 'photo', label: 'Photo' },
  { key: 'first_name', label: 'First name' },
  { key: 'email', label: 'Email' },
  { key: 'follower_count', label: 'Followers', align: 'num' },
  { key: 'following_count', label: 'Following', align: 'num' },
  { key: 'match_count', label: 'Matches', align: 'num' },
  { key: 'answer_count', label: 'Answers', align: 'num' },
  { key: 'created_at', label: 'Joined' },
  { key: 'last_sign_in_at', label: 'Last login' },
];

type FeedSettingsLoad = AdminPersonFeedSettings | 'loading' | 'error';

export default function People() {
  const [people, setPeople] = useState<Person[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { userId } = useAuth();
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ person: Person; makeAdmin: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [filterDefs, setFilterDefs] = useState<FilterDefinition[]>([]);
  const [feedSettingsByPerson, setFeedSettingsByPerson] = useState<Record<string, FeedSettingsLoad>>({});

  useEffect(() => {
    supabase.rpc('admin_list_admin_ids').then(({ data }) => {
      setAdminIds(new Set((data ?? []) as string[]));
    });
    supabase
      .from('filter_definitions')
      .select('key, label, control, min_value, max_value, unit, sort_order')
      .eq('active', true)
      .order('sort_order')
      .then(({ data, error: defsError }) => {
        if (defsError) return;
        setFilterDefs((data ?? []).map((row) => mapFilterDefinition(row as Record<string, unknown>)));
      });
    supabase.rpc('admin_list_people').then(async ({ data, error: loadError }) => {
      if (loadError) return setError(loadError.message);
      const rows = (data ?? []) as Person[];
      setPeople(rows);
      setError(null);
      const next: Record<string, string> = {};
      for (const person of rows) {
        const first = firstPhoto(person);
        if (!first) continue;
        const signed = await supabase.storage.from('profile-photos').createSignedUrl(first.storage_path, 3600);
        if (signed.data?.signedUrl) next[first.storage_path] = signed.data.signedUrl;
      }
      setPhotoUrls(next);
    });
  }, []);

  const rows = useMemo(() => sortPeople(people, sortKey, sortDir), [people, sortKey, sortDir]);

  async function loadFeedSettings(personId: string) {
    setFeedSettingsByPerson((prev) => {
      const existing = prev[personId];
      if (existing && existing !== 'loading' && existing !== 'error') return prev;
      return { ...prev, [personId]: 'loading' };
    });
    const { data, error: loadError } = await supabase.rpc('admin_get_person_feed_settings', { p_user_id: personId });
    if (loadError) {
      setFeedSettingsByPerson((prev) => ({ ...prev, [personId]: 'error' }));
      return;
    }
    const row = data as Record<string, unknown>;
    setFeedSettingsByPerson((prev) => ({
      ...prev,
      [personId]: {
        filters:
          row.filters && typeof row.filters === 'object' && !Array.isArray(row.filters)
            ? (row.filters as Record<string, unknown>)
            : {},
        filters_updated_at: row.filters_updated_at ? String(row.filters_updated_at) : null,
        shared_interests: String(row.shared_interests ?? 'medium'),
        specific_interests: Array.isArray(row.specific_interests) ? (row.specific_interests as string[]) : [],
        relationship_goals: String(row.relationship_goals ?? 'medium'),
        distance: String(row.distance ?? 'medium'),
      },
    }));
  }

  async function toggle(person: Person) {
    if (openId === person.id) {
      setOpenId(null);
      return;
    }
    setOpenId(person.id);
    void loadFeedSettings(person.id);
    const missing = person.photos.filter((photo) => !photoUrls[photo.storage_path]);
    if (missing.length === 0) return;
    const next = { ...photoUrls };
    for (const photo of missing) {
      const signed = await supabase.storage.from('profile-photos').createSignedUrl(photo.storage_path, 3600);
      if (signed.data?.signedUrl) next[photo.storage_path] = signed.data.signedUrl;
    }
    setPhotoUrls(next);
  }

  function who(person: Person) {
    return person.first_name ?? person.email ?? 'this person';
  }

  async function confirmAdminChange() {
    if (!pending) return;
    setSaving(true);
    setAdminError(null);
    const { error: saveError } = await supabase.rpc('admin_set_admin', {
      p_user_id: pending.person.id,
      p_make_admin: pending.makeAdmin,
    });
    setSaving(false);
    if (saveError) {
      setAdminError(saveError.message);
      return;
    }
    setAdminIds((current) => {
      const next = new Set(current);
      if (pending.makeAdmin) next.add(pending.person.id);
      else next.delete(pending.person.id);
      return next;
    });
    setPending(null);
  }

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'created_at' || key === 'last_sign_in_at' || key.endsWith('_count') ? 'desc' : 'asc');
  }

  return (
    <div>
      <h2>People</h2>
      <p className="muted">
        Every account, finished or not, reported or not. Click a column title to sort.
        Follower names are not shown: only the counts, which that person can already
        see on their own profile. Click a row for the full profile, including photos
        and their current Feed Settings.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <div className="table-wrap">
        <table className="sheet">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.align === 'num' ? 'num' : undefined}>
                  <button
                    type="button"
                    className="sort"
                    onClick={() => sortBy(col.key)}
                    aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    {col.label}
                    {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((person) => {
              const thumb = firstPhoto(person);
              const open = openId === person.id;
              const feedLoad = open ? feedSettingsByPerson[person.id] : undefined;
              const feedSettings =
                feedLoad && feedLoad !== 'loading' && feedLoad !== 'error' ? feedLoad : null;
              const feedRefreshing = feedLoad === 'loading' && feedSettings != null;
              return (
                <Fragment key={person.id}>
                  <tr
                    className={open ? 'clickable open' : 'clickable'}
                    onClick={() => toggle(person)}
                  >
                    <td>
                      {thumb && photoUrls[thumb.storage_path]
                        ? <img className="thumb" src={photoUrls[thumb.storage_path]} alt="" />
                        : <span className="thumb empty" aria-hidden="true" />}
                    </td>
                    <td>
                      {person.first_name ?? '-'}
                      {adminIds.has(person.id) ? <span className="badge">Admin</span> : null}
                    </td>
                    <td>{person.email ?? '-'}</td>
                    <td className="num">{person.follower_count}</td>
                    <td className="num">{person.following_count}</td>
                    <td className="num">{person.match_count}</td>
                    <td className="num">{person.answer_count}</td>
                    <td>{formatWhen(person.created_at)}</td>
                    <td>{person.last_sign_in_at ? formatWhen(person.last_sign_in_at) : 'Never'}</td>
                  </tr>
                  {open ? (
                    <tr key={`${person.id}-detail`} className="detail">
                      <td colSpan={columns.length}>
                        <div className="person-detail-columns">
                          <div className="stack">
                            <div className="muted">
                              {person.profile_completed_at ? 'Profile finished' : 'Profile not finished'}
                              {person.age != null ? ` · ${person.age}` : ''}
                            </div>
                            <div className="row">
                              <span><strong>Admin access:</strong> {adminIds.has(person.id) ? 'Yes' : 'No'}</span>
                              {adminIds.has(person.id) ? (
                                person.id === userId
                                  ? <span className="muted">You cannot remove your own admin access.</span>
                                  : (
                                    <button type="button" onClick={() => { setAdminError(null); setPending({ person, makeAdmin: false }); }}>
                                      Remove admin
                                    </button>
                                  )
                              ) : (
                                <button type="button" onClick={() => { setAdminError(null); setPending({ person, makeAdmin: true }); }}>
                                  Make admin
                                </button>
                              )}
                            </div>
                            <div className="photos">
                              {person.photos.length === 0 ? <span className="muted">No photos</span> : null}
                              {person.photos.map((photo) => (
                                photoUrls[photo.storage_path]
                                  ? <img key={photo.storage_path} src={photoUrls[photo.storage_path]} alt={`Photo ${photo.position}`} />
                                  : <span key={photo.storage_path} className="muted">Photo {photo.position} unavailable</span>
                              ))}
                            </div>
                            {person.about_me
                              ? <p><strong>About Me</strong><br />{person.about_me}</p>
                              : <p className="muted">No About Me</p>}
                            <p>
                              {line('Gender', person.gender)}
                              {line('Orientation', (person.sexual_orientation ?? []).join(', '))}
                              {line('Interested in', (person.interested_in ?? []).join(', '))}
                              {line(
                                'Height',
                                person.height_inches != null
                                  ? `${Math.floor(person.height_inches / 12)} ft ${person.height_inches % 12} in`
                                  : null
                              )}
                              {line('City', person.city)}
                              {line('Location lookup', person.latitude != null && person.longitude != null ? `${person.latitude}, ${person.longitude}` : null)}
                              {line('Occupation', person.job_title)}
                              {line('School', person.school)}
                              {line('Interests', (person.interests ?? []).join(', '))}
                              {line('Relationship goal', person.relationship_goal)}
                              {line('Allow followers', person.allow_followers ? 'Yes' : 'No')}
                              {line('Time zone', person.time_zone)}
                              {line('Birthday', person.birthday)}
                            </p>
                          </div>
                          <div className="stack person-feed-settings">
                            <h3 className="person-feed-settings-title">Feed settings</h3>
                            <p className="muted">What this person sees in their feed today (filters and ranking).</p>
                            {feedLoad === 'loading' && !feedSettings ? <p className="muted">Loading feed settings…</p> : null}
                            {feedRefreshing ? <p className="muted">Refreshing…</p> : null}
                            {feedLoad === 'error' ? (
                              <p className="error">
                                Could not load feed settings.{' '}
                                <button type="button" className="text-link" onClick={() => loadFeedSettings(person.id)}>Try again</button>
                              </p>
                            ) : null}
                            {feedSettings ? (
                              <>
                                {feedSettings.filters_updated_at ? (
                                  <p className="muted">Filters last saved {formatWhen(feedSettings.filters_updated_at)}</p>
                                ) : null}
                                <p><strong>Filters</strong></p>
                                <dl className="feed-settings-dl">
                                  {describeFilterLines(filterDefs, feedSettings.filters).map(({ label, value }) => (
                                    <Fragment key={label}>
                                      <dt>{label}</dt>
                                      <dd>{value}</dd>
                                    </Fragment>
                                  ))}
                                </dl>
                                <p><strong>Ranking</strong></p>
                                <dl className="feed-settings-dl">
                                  {describeRankingLines(feedSettings).map(({ label, value }) => (
                                    <Fragment key={label}>
                                      <dt>{label}</dt>
                                      <dd>{value}</dd>
                                    </Fragment>
                                  ))}
                                </dl>
                                {specificInterestsSummary(feedSettings) ? (
                                  <p className="muted">
                                    <strong>Specific interests:</strong> {specificInterestsSummary(feedSettings)}
                                  </p>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {pending ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
            <h3 id="admin-modal-title">
              {pending.makeAdmin ? `Make ${who(pending.person)} an admin?` : `Remove admin access from ${who(pending.person)}?`}
            </h3>
            <p>
              {pending.makeAdmin
                ? `${who(pending.person)} (${pending.person.email ?? 'no email'}) will be able to sign in to this website and edit questions and settings, review reports, and see every profile and video.`
                : `${who(pending.person)} (${pending.person.email ?? 'no email'}) will no longer be able to use this website. Their account and answers stay as they are.`}
            </p>
            {adminError ? <p className="error">{adminError}</p> : null}
            <div className="row">
              <button type="button" onClick={() => setPending(null)} disabled={saving}>Cancel</button>
              <button type="button" className="primary" onClick={confirmAdminChange} disabled={saving}>
                {saving ? 'Saving…' : pending.makeAdmin ? 'Make admin' : 'Remove admin'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function firstPhoto(person: Person): Photo | undefined {
  return (person.photos ?? []).find((photo) => photo.position === 1) ?? person.photos?.[0];
}

function sortValue(person: Person, key: SortKey): string | number | null {
  if (key === 'photo') return firstPhoto(person) ? 1 : 0;
  if (key === 'first_name') return person.first_name?.toLowerCase() ?? null;
  if (key === 'email') return person.email?.toLowerCase() ?? null;
  if (key === 'created_at') return person.created_at ? Date.parse(person.created_at) : null;
  if (key === 'last_sign_in_at') return person.last_sign_in_at ? Date.parse(person.last_sign_in_at) : null;
  return person[key];
}

function sortPeople(people: Person[], key: SortKey, dir: 'asc' | 'desc'): Person[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...people].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  });
}

function line(label: string, value: string | null | undefined) {
  if (!value) return null;
  return <span key={label}>{label}: {value}<br /></span>;
}
