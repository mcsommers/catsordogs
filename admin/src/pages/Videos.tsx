import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { formatDay, formatWhen } from '../dates';
import Player from '../Player';

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

  async function watch(row: VideoRow) {
    setError(null);
    const { data, error: watchError } = await supabase.functions.invoke('get-playback-url', {
      body: { as_admin: true, video_id: row.video_id, answer_id: row.answer_id },
    });
    if (watchError) return setError(watchError.message);
    if (!data?.playback_url) return setError(data?.error ?? 'That video is not available to watch yet.');
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
        {from || to ? (
          <button type="button" onClick={() => setParams({}, { replace: true })}>Clear dates</button>
        ) : null}
      </div>
      {from && to && from > to ? (
        <p className="error">The start date is after the end date.</p>
      ) : from || to ? (
        <p className="muted">{rangeLabel(from, to)}</p>
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
          {visibleRows(rows, from, to).map((row) => (
            <tr key={row.video_id}>
              <td>{row.first_name ?? 'No name'}</td>
              <td>
                {formatDay(row.question_date)} · {row.question_text}
                {row.caption_text ? <div className="muted">{row.caption_text}</div> : null}
                <div className="muted">{formatWhen(row.created_at)}</div>
              </td>
              <td>
                {row.answer_status ?? row.video_status}
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
      {visibleRows(rows, from, to).length === 0 && !(from && to && from > to) ? (
        <p className="muted">{from || to ? 'No videos in that date range.' : 'No videos yet.'}</p>
      ) : null}
    </div>
  );
}

function visibleRows(rows: VideoRow[], from: string, to: string): VideoRow[] {
  if (from && to && from > to) return [];
  return rows.filter((row) => {
    if (from && row.question_date < from) return false;
    if (to && row.question_date > to) return false;
    return true;
  });
}

function rangeLabel(from: string, to: string): string {
  if (from && to && from === to) return `Only videos for ${formatDay(from)}.`;
  if (from && to) return `Videos from ${formatDay(from)} through ${formatDay(to)}.`;
  if (from) return `Videos on or after ${formatDay(from)}.`;
  return `Videos on or before ${formatDay(to)}.`;
}
