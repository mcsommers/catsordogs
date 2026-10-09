import { useEffect, useState, type FormEvent } from 'react';
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
  daily_question_notify_time: string;
  help_support_url: string | null;
  updated_at: string;
};

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
  daily_question_notify_time: '09:00:00',
  help_support_url: null,
  updated_at: '',
};

export default function Settings() {
  const [row, setRow] = useState<SettingsRow>(empty);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('*').single().then(({ data, error: loadError }) => {
      if (loadError || !data) return setError(loadError?.message ?? 'Could not load settings.');
      setRow(data as SettingsRow);
    });
  }, []);

  function set<K extends keyof SettingsRow>(key: K, value: SettingsRow[K]) {
    setSaved(false);
    setRow((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const time = row.daily_question_notify_time.slice(0, 5);
    const { error: saveError } = await supabase.from('app_settings').update({
      recording_length_seconds: Number(row.recording_length_seconds),
      min_watch_seconds: Number(row.min_watch_seconds),
      onboarding_mode: row.onboarding_mode,
      onboarding_fixed_question: row.onboarding_fixed_question.trim(),
      followed_content_cap_percent: Number(row.followed_content_cap_percent),
      flag_threshold: Number(row.flag_threshold),
      profile_report_priority_count: Number(row.profile_report_priority_count),
      feed_lookback_days: Number(row.feed_lookback_days),
      max_recordings_per_day: Number(row.max_recordings_per_day),
      daily_question_notify_time: `${time}:00`,
      help_support_url: row.help_support_url?.trim() ? row.help_support_url.trim() : null,
    }).eq('id', true);
    if (saveError) return setError(saveError.message);
    setSaved(true);
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
      {saved ? <p>Saved.</p> : null}
      {row.updated_at ? <p className="muted">Last saved {formatWhen(row.updated_at)}.</p> : null}
      <NumberField label="Recording length (3 to 60 seconds)" value={row.recording_length_seconds} min={3} max={60} onChange={(n) => set('recording_length_seconds', n)} />
      <NumberField label="Minimum watch time before skip (seconds, not longer than the recording)" value={row.min_watch_seconds} min={0} max={60} onChange={(n) => set('min_watch_seconds', n)} />
      <NumberField label="Followed people, share of the feed (0 to 100 percent)" value={row.followed_content_cap_percent} min={0} max={100} onChange={(n) => set('followed_content_cap_percent', n)} />
      <NumberField label="Flags that hide one video (at least 1)" value={row.flag_threshold} min={1} onChange={(n) => set('flag_threshold', n)} />
      <NumberField label="Different people reporting a profile before it is high priority" value={row.profile_report_priority_count} min={1} onChange={(n) => set('profile_report_priority_count', n)} />
      <NumberField label="Feed look-back days (0 to 90)" value={row.feed_lookback_days} min={0} max={90} onChange={(n) => set('feed_lookback_days', n)} />
      <NumberField label="Recordings a person may start per day (at least 1)" value={row.max_recordings_per_day} min={1} onChange={(n) => set('max_recordings_per_day', n)} />
      <label className="card setting-row">
        <span>Daily-question notification time (their own time zone)</span>
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
      <button className="primary" type="submit">Save settings</button>
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
