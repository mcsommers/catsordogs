import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../supabase';
import { formatWhen } from '../dates';

type SettingsRow = {
  recording_length_seconds: number;
  min_watch_seconds: number;
  onboarding_mode: 'todays_question' | 'fixed_question';
  onboarding_fixed_question: string;
  followed_content_cap_percent: number;
  flag_threshold: number;
  profile_report_priority_count: number;
  feed_lookback_days: number;
  max_recordings_per_day: number;
  nudge_delay_minutes: number;
  daily_question_notify_time: string;
  help_support_url: string | null;
  location_provider: 'open_meteo' | 'google_places';
  updated_at: string;
};

type SettingsSnapshot = Omit<SettingsRow, 'updated_at'>;

const empty: SettingsRow = {
  recording_length_seconds: 14,
  min_watch_seconds: 3,
  onboarding_mode: 'todays_question',
  onboarding_fixed_question: 'Cats or dogs?',
  followed_content_cap_percent: 30,
  flag_threshold: 5,
  profile_report_priority_count: 3,
  feed_lookback_days: 7,
  max_recordings_per_day: 10,
  nudge_delay_minutes: 0,
  daily_question_notify_time: '12:03:00',
  help_support_url: null,
  location_provider: 'open_meteo',
  updated_at: '',
};

function snapshotFromRow(row: SettingsRow): SettingsSnapshot {
  const time = row.daily_question_notify_time.slice(0, 5);
  return {
    recording_length_seconds: Number(row.recording_length_seconds),
    min_watch_seconds: Number(row.min_watch_seconds),
    onboarding_mode: row.onboarding_mode,
    onboarding_fixed_question: row.onboarding_fixed_question.trim(),
    followed_content_cap_percent: Number(row.followed_content_cap_percent),
    flag_threshold: Number(row.flag_threshold),
    profile_report_priority_count: Number(row.profile_report_priority_count),
    feed_lookback_days: Number(row.feed_lookback_days),
    max_recordings_per_day: Number(row.max_recordings_per_day),
    nudge_delay_minutes: Number(row.nudge_delay_minutes),
    daily_question_notify_time: `${time}:00`,
    help_support_url: row.help_support_url?.trim() ? row.help_support_url.trim() : null,
    location_provider: row.location_provider === 'google_places' ? 'google_places' : 'open_meteo',
  };
}

function snapshotsEqual(a: SettingsSnapshot, b: SettingsSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function Settings() {
  const [row, setRow] = useState<SettingsRow>(empty);
  const [baseline, setBaseline] = useState<SettingsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('*').single().then(({ data, error: loadError }) => {
      if (loadError || !data) return setError(loadError?.message ?? 'Could not load settings.');
      const loaded = data as SettingsRow;
      setRow(loaded);
      setBaseline(snapshotFromRow(loaded));
    });
  }, []);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return !snapshotsEqual(snapshotFromRow(row), baseline);
  }, [row, baseline]);

  function set<K extends keyof SettingsRow>(key: K, value: SettingsRow[K]) {
    setSavedNotice(false);
    setRow((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!dirty || saving) return;
    setError(null);
    setSaving(true);
    const payload = snapshotFromRow(row);
    const { error: saveError } = await supabase.from('app_settings').update({
      recording_length_seconds: payload.recording_length_seconds,
      min_watch_seconds: payload.min_watch_seconds,
      onboarding_mode: payload.onboarding_mode,
      onboarding_fixed_question: payload.onboarding_fixed_question,
      followed_content_cap_percent: payload.followed_content_cap_percent,
      flag_threshold: payload.flag_threshold,
      profile_report_priority_count: payload.profile_report_priority_count,
      feed_lookback_days: payload.feed_lookback_days,
      max_recordings_per_day: payload.max_recordings_per_day,
      nudge_delay_minutes: payload.nudge_delay_minutes,
      daily_question_notify_time: payload.daily_question_notify_time,
      help_support_url: payload.help_support_url,
      location_provider: payload.location_provider,
    }).eq('id', true);
    setSaving(false);
    if (saveError) return setError(saveError.message);
    setBaseline(payload);
    setSavedNotice(true);
    const again = await supabase.from('app_settings').select('updated_at').single();
    if (again.data) setRow((current) => ({ ...current, updated_at: again.data.updated_at }));
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <h2>Settings</h2>
      <p className="muted">
        One set of values for the whole app. The phone reads the recording length, the minimum watch
        time, and the Help address. Everything else is used by the server. Saving a value outside the
        allowed range is rejected.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {savedNotice ? <p className="notice-success" role="status">Changes saved.</p> : null}
      {row.updated_at ? <p className="muted">Last saved {formatWhen(row.updated_at)}.</p> : null}
      <NumberField label="Recording length (3 to 60 seconds)" value={row.recording_length_seconds} min={3} max={60} onChange={(n) => set('recording_length_seconds', n)} />
      <NumberField label="Minimum watch time for a view to count (seconds, not longer than the recording)" value={row.min_watch_seconds} min={0} max={60} onChange={(n) => set('min_watch_seconds', n)} />
      <NumberField label="Followed people, share of the feed (0 to 100 percent)" value={row.followed_content_cap_percent} min={0} max={100} onChange={(n) => set('followed_content_cap_percent', n)} />
      <NumberField label="Flags that hide one video (at least 1)" value={row.flag_threshold} min={1} onChange={(n) => set('flag_threshold', n)} />
      <NumberField label="Different people reporting a profile before it is high priority" value={row.profile_report_priority_count} min={1} onChange={(n) => set('profile_report_priority_count', n)} />
      <NumberField label="Feed look-back days (0 to 90)" value={row.feed_lookback_days} min={0} max={90} onChange={(n) => set('feed_lookback_days', n)} />
      <NumberField label="Recordings a person may start per day (at least 1)" value={row.max_recordings_per_day} min={1} onChange={(n) => set('max_recordings_per_day', n)} />
      <NumberField label="Nudge notification delay (0 to 60 minutes; 0 sends it right away)" value={row.nudge_delay_minutes} min={0} max={60} onChange={(n) => set('nudge_delay_minutes', n)} />
      <label className="card setting-row">
        <span>Daily Question Send Time (each person&apos;s own time zone)</span>
        <input type="time" step={60} value={row.daily_question_notify_time.slice(0, 5)} onChange={(e) => set('daily_question_notify_time', e.target.value)} required />
      </label>
      <label className="card setting-row">
        <span>First recording</span>
        <select value={row.onboarding_mode} onChange={(e) => set('onboarding_mode', e.target.value as SettingsRow['onboarding_mode'])}>
          <option value="todays_question">Today’s question</option>
          <option value="fixed_question">A fixed question</option>
        </select>
      </label>
      <label className="card setting-row">
        <span>Fixed question text (used only when “A fixed question” is selected)</span>
        <input value={row.onboarding_fixed_question} maxLength={200} onChange={(e) => set('onboarding_fixed_question', e.target.value)} required />
      </label>
      <label className="card setting-row">
        <span>Help & Support web address (https, or leave empty)</span>
        <input value={row.help_support_url ?? ''} placeholder="https://" onChange={(e) => set('help_support_url', e.target.value)} />
      </label>
      <label className="card setting-row">
        <span>City lookup</span>
        <select
          value={row.location_provider === 'google_places' ? 'google_places' : 'open_meteo'}
          onChange={(e) => set('location_provider', e.target.value as SettingsRow['location_provider'])}
        >
          <option value="open_meteo">Open-Meteo</option>
          <option value="google_places">Google Places</option>
        </select>
      </label>
      <p className="muted setting-help">
        Used when someone types a city on their profile, and again to look up coordinates for distance.
        Open-Meteo is the default and needs no key. Google Places needs a server API key
        (GOOGLE_PLACES_API_KEY). That key is a secret. It is not entered on this page. Switch to Google
        Places only after the key is set on the server.
      </p>
      <button className="primary" type="submit" disabled={!dirty || saving || !baseline}>
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </form>
  );
}

function NumberField({ label, value, min, max, onChange }: {
  label: string; value: number; min?: number; max?: number; onChange: (n: number) => void;
}) {
  return (
    <label className="card setting-row">
      <span>{label}</span>
      <input type="number" value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} required />
    </label>
  );
}
