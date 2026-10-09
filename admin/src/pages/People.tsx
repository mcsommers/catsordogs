import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { formatWhen } from '../dates';

type Photo = { position: number; storage_path: string };
type Person = {
  id: string;
  email: string | null;
  first_name: string | null;
  birthday: string | null;
  age: number | null;
  gender: string | null;
  pronouns: string[];
  sexual_orientation: string[];
  height_cm: number | null;
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

export default function People() {
  const [people, setPeople] = useState<Person[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
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

  async function toggle(person: Person) {
    if (openId === person.id) {
      setOpenId(null);
      return;
    }
    setOpenId(person.id);
    const missing = person.photos.filter((photo) => !photoUrls[photo.storage_path]);
    if (missing.length === 0) return;
    const next = { ...photoUrls };
    for (const photo of missing) {
      const signed = await supabase.storage.from('profile-photos').createSignedUrl(photo.storage_path, 3600);
      if (signed.data?.signedUrl) next[photo.storage_path] = signed.data.signedUrl;
    }
    setPhotoUrls(next);
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
        see on their own profile. Click a row for the full profile, including photos.
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
                    <td>{person.first_name ?? '—'}</td>
                    <td>{person.email ?? '—'}</td>
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
                        <div className="stack">
                          <div className="muted">
                            {person.profile_completed_at ? 'Profile finished' : 'Profile not finished'}
                            {person.age != null ? ` · ${person.age}` : ''}
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
                            {line('Pronouns', (person.pronouns ?? []).join(', '))}
                            {line('Orientation', (person.sexual_orientation ?? []).join(', '))}
                            {line('Height', person.height_cm ? `${person.height_cm} cm` : null)}
                            {line('City', person.city)}
                            {line('Location lookup', person.latitude != null && person.longitude != null ? `${person.latitude}, ${person.longitude}` : null)}
                            {line('Job', [person.job_title, person.company].filter(Boolean).join(' at ') || null)}
                            {line('School', person.school)}
                            {line('Lifestyle', (person.lifestyle_tags ?? []).join(', '))}
                            {line('Languages', (person.languages ?? []).join(', '))}
                            {line('Interests', (person.interests ?? []).join(', '))}
                            {line('Relationship goal', person.relationship_goal)}
                            {line('Allow followers', person.allow_followers ? 'Yes' : 'No')}
                            {line('Time zone', person.time_zone)}
                            {line('Birthday', person.birthday)}
                          </p>
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
