import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { formatDay, formatWhen } from '../dates';
import Player from '../Player';
import { MultiSelectDropdown } from '../MultiSelectDropdown';
import { VIDEO_STATE_OPTIONS, videoDisplayState } from '../videoStates';
import { invokeFunctionErrorMessage } from '../invokeFunction';

type VideoRow = {
  video_id: string;
  user_id: string;
  first_name: string | null;
  question_date: string;
  question_text: string;
  video_status: string;
  duration_seconds: number | null;
  answer_id: string | null;
  answer_status: string | null;
  caption_text: string | null;
  reject_reason: string | null;
  created_at: string;
};

export default function Videos() {
  const [params, setParams] = useSearchParams();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [stateFilter, setStateFilter] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [watchUrl, setWatchUrl] = useState<string | null>(null);

  function setRange(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams();
    if (nextFrom) next.set('from', nextFrom);
    if (nextTo) next.set('to', nextTo);
    setParams(next, { replace: true });
  }

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc('admin_list_videos');
    if (loadError) return setError(loadError.message);
    setRows((data ?? []) as VideoRow[]);
    setError(null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filterRows(rows, from, to, stateFilter);

  async function watch(row: VideoRow) {
    setError(null);
    setWatchUrl(null);
    const { data, error: watchError } = await supabase.functions.invoke('get-playback-url', {
      body: {
        as_admin: true,
        video_id: row.video_id,
        ...(row.answer_id ? { answer_id: row.answer_id } : {}),
      },
    });
    if (watchError) return setError(await invokeFunctionErrorMessage(watchError, data));
    if (!data?.playback_url) {
      return setError(await invokeFunctionErrorMessage(null, data) || 'That video is not available to watch yet.');
    }
    setWatchUrl(data.playback_url);
  }

  async function unhide(answerId: string) {
    setError(null);
    const { error: saveError } = await supabase.rpc('admin_unhide_answer', { p_answer_id: answerId });
    if (saveError) return setError(saveError.message);
    await load();
  }

  return (
    <div>
      <h2>Videos</h2>
      <p className="muted">
        Every recording, including ones that are hidden. Watching here does not count as a view.
        Unhide puts that one video back. It does not change the person’s account.
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        <label>
          Question date, from
          <input type="date" value={from} onChange={(e) => setRange(e.target.value, to)} />
        </label>
        <label>
          Question date, to
          <input type="date" value={to} onChange={(e) => setRange(from, e.target.value)} />
        </label>
        <MultiSelectDropdown
          label="State"
          options={VIDEO_STATE_OPTIONS}
          selected={stateFilter}
          onChange={setStateFilter}
        />
        {from || to || stateFilter.size > 0 ? (
          <button
            type="button"
            onClick={() => {
              setParams({}, { replace: true });
              setStateFilter(new Set());
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>
      {from && to && from > to ? (
        <p className="error">The start date is after the end date.</p>
      ) : from || to ? (
        <p className="muted">{rangeLabel(from, to)}</p>
      ) : null}
      {stateFilter.size > 0 ? (
        <p className="muted">Showing only: {stateFilterSummary(stateFilter)}.</p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {watchUrl ? <Player url={watchUrl} onClose={() => setWatchUrl(null)} /> : null}
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Question</th>
            <th>State</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.video_id}>
              <td>{row.first_name ?? 'No name'}</td>
              <td>
                {formatDay(row.question_date)} · {row.question_text}
                {row.caption_text ? <div className="muted">{row.caption_text}</div> : null}
                <div className="muted">{formatWhen(row.created_at)}</div>
              </td>
              <td>
                {videoDisplayState(row)}
                {row.reject_reason ? <div className="muted">{row.reject_reason}</div> : null}
              </td>
              <td>
                <div className="row">
                  {row.video_status === 'ready' ? <button type="button" onClick={() => watch(row)}>Watch</button> : null}
                  {row.answer_status === 'disabled' && row.answer_id ? (
                    <button className="primary" type="button" onClick={() => unhide(row.answer_id!)}>Unhide</button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && !(from && to && from > to) ? (
        <p className="muted">{emptyMessage(from, to, stateFilter)}</p>
      ) : null}
    </div>
  );
}

function filterRows(rows: VideoRow[], from: string, to: string, states: ReadonlySet<string>): VideoRow[] {
  if (from && to && from > to) return [];
  return rows.filter((row) => {
    if (from && row.question_date < from) return false;
    if (to && row.question_date > to) return false;
    if (states.size > 0 && !states.has(videoDisplayState(row))) return false;
    return true;
  });
}

function stateFilterSummary(states: ReadonlySet<string>): string {
  const labels = VIDEO_STATE_OPTIONS.filter((o) => states.has(o.value)).map((o) => o.label);
  return labels.join(', ');
}

function emptyMessage(from: string, to: string, states: ReadonlySet<string>): string {
  if (from || to || states.size > 0) return 'No videos match these filters.';
  return 'No videos yet.';
}

function rangeLabel(from: string, to: string): string {
  if (from && to && from === to) return `Only videos for ${formatDay(from)}.`;
  if (from && to) return `Videos from ${formatDay(from)} through ${formatDay(to)}.`;
  if (from) return `Videos on or after ${formatDay(from)}.`;
  return `Videos on or before ${formatDay(to)}.`;
}
