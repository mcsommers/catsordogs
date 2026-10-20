import { Fragment, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { formatDay } from '../dates';
import Player from '../Player';
import { MultiSelectDropdown } from '../MultiSelectDropdown';
import { VIDEO_STATE_OPTIONS, videoDisplayState, videoStateLabel } from '../videoStates';
import { invokeFunctionErrorMessage } from '../invokeFunction';

type VideoRow = {
  video_id: string;
  user_id: string;
  first_name: string | null;
  email: string | null;
  question_date: string;
  question_text: string;
  video_status: string;
  duration_seconds: number | null;
  answer_id: string | null;
  answer_status: string | null;
  caption_text: string | null;
  auto_caption_text: string | null;
  reject_reason: string | null;
  created_at: string;
  answer_submitted_at: string | null;
};

const COLUMNS = 8;
const PAGE_SIZES = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

export default function Videos() {
  const [params, setParams] = useSearchParams();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [stateFilter, setStateFilter] = useState<Set<string>>(() => new Set(['live']));
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [playbacks, setPlaybacks] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [watchUrl, setWatchUrl] = useState<string | null>(null);
  const [watchLoading, setWatchLoading] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    const ready = rows.filter((row) => row.video_status === 'ready');
    if (ready.length === 0) return;
    let cancelled = false;
    const queue = [...ready];

    async function next() {
      while (queue.length > 0 && !cancelled) {
        const row = queue.shift();
        if (!row) return;
        const { data } = await supabase.functions.invoke('get-playback-url', {
          body: {
            as_admin: true,
            video_id: row.video_id,
            ...(row.answer_id ? { answer_id: row.answer_id } : {}),
          },
        });
        if (cancelled || !data) continue;
        if (data.thumbnail_url) {
          setThumbs((prev) => (prev[row.video_id] ? prev : { ...prev, [row.video_id]: data.thumbnail_url }));
        }
        if (data.playback_url) {
          setPlaybacks((prev) => (prev[row.video_id] ? prev : { ...prev, [row.video_id]: data.playback_url }));
        }
      }
    }

    const workers = Math.min(4, queue.length);
    void Promise.all(Array.from({ length: workers }, () => next()));
    return () => { cancelled = true; };
  }, [rows]);

  const filtered = filterRows(rows, from, to, stateFilter);
  const filterKey = `${from}|${to}|${[...stateFilter].sort().join(',')}|${pageSize}`;
  useEffect(() => {
    setPage(1);
    setOpenId(null);
    setWatchUrl(null);
  }, [filterKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function goToPage(next: number) {
    setPage(next);
    setOpenId(null);
    setWatchUrl(null);
  }

  async function toggleWatch(row: VideoRow) {
    if (row.video_status !== 'ready') return;
    if (openId === row.video_id) {
      setOpenId(null);
      setWatchUrl(null);
      setWatchLoading(false);
      return;
    }
    setError(null);
    setOpenId(row.video_id);
    const cached = playbacks[row.video_id];
    if (cached) {
      setWatchUrl(cached);
      setWatchLoading(false);
      return;
    }
    setWatchUrl(null);
    setWatchLoading(true);
    const { data, error: watchError } = await supabase.functions.invoke('get-playback-url', {
      body: {
        as_admin: true,
        video_id: row.video_id,
        ...(row.answer_id ? { answer_id: row.answer_id } : {}),
      },
    });
    setWatchLoading(false);
    if (watchError) return setError(await invokeFunctionErrorMessage(watchError, data));
    if (!data?.playback_url) {
      return setError(await invokeFunctionErrorMessage(null, data) || 'That video is not available to watch yet.');
    }
    setWatchUrl(data.playback_url);
    if (data.thumbnail_url) {
      setThumbs((prev) => ({ ...prev, [row.video_id]: data.thumbnail_url }));
    }
    setPlaybacks((prev) => ({ ...prev, [row.video_id]: data.playback_url }));
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
        Every recording, including ones that are hidden. Click a thumbnail to play that video in the row.
        Watching here does not count as a view. Unhide puts that one video back. It does not change the person’s account.
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
          label="Status"
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
      <div className="table-wrap">
        <table className="sheet videos">
          <thead>
            <tr>
              <th>Thumbnail</th>
              <th>Date</th>
              <th>Name</th>
              <th>Email</th>
              <th>Question</th>
              <th>Caption</th>
              <th>Auto caption</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const open = openId === row.video_id;
              const name = row.first_name ?? 'No name';
              const ready = row.video_status === 'ready';
              const status = videoDisplayState(row);
              return (
                <Fragment key={row.video_id}>
                  <tr className={open ? 'open' : undefined}>
                    <td>
                      {ready ? (
                        <button
                          type="button"
                          className="video-thumb"
                          aria-expanded={open}
                          aria-label={open ? `Close ${name}'s video` : `Play ${name}'s video`}
                          onClick={() => toggleWatch(row)}
                        >
                          {thumbs[row.video_id]
                            ? <img src={thumbs[row.video_id]} alt="" />
                            : <span className="video-thumb-placeholder" />}
                        </button>
                      ) : (
                        <span className="video-thumb-placeholder" aria-hidden="true" />
                      )}
                    </td>
                    <td>{row.answer_submitted_at ? <SubmittedDate iso={row.answer_submitted_at} /> : '-'}</td>
                    <td>{name}</td>
                    <td>{row.email ?? '-'}</td>
                    <td className="wrap">{row.question_text}</td>
                    <td className="wrap">{row.caption_text || '-'}</td>
                    <td className="wrap">{row.auto_caption_text || '-'}</td>
                    <td>
                      {videoStateLabel(status)}
                      {row.reject_reason ? <div className="muted">{row.reject_reason}</div> : null}
                      {row.answer_status === 'disabled' && row.answer_id ? (
                        <div className="row" style={{ marginTop: 8 }}>
                          <button className="primary" type="button" onClick={() => unhide(row.answer_id!)}>Unhide</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  {open ? (
                    <tr className="detail">
                      <td colSpan={COLUMNS}>
                        <div className="video-expand">
                          {watchUrl ? (
                            <Player url={watchUrl} onClose={() => { setOpenId(null); setWatchUrl(null); }} />
                          ) : (
                            <p className="muted">{watchLoading ? 'Loading video…' : 'That video is not available to watch yet.'}</p>
                          )}
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
      {filtered.length > 0 ? (
        <div className="pager">
          <label>
            Per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
            >
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <div className="row">
            <button type="button" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>Previous</button>
            <span className="muted">Page {currentPage} of {pageCount}</span>
            <button type="button" disabled={currentPage >= pageCount} onClick={() => goToPage(currentPage + 1)}>Next</button>
          </div>
        </div>
      ) : null}
      {filtered.length === 0 && !(from && to && from > to) ? (
        <p className="muted">{emptyMessage(from, to, stateFilter)}</p>
      ) : null}
    </div>
  );
}

function SubmittedDate({ iso }: { iso: string }) {
  const when = new Date(iso);
  const date = when.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const time = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <>
      <div>{date}</div>
      <div className="muted">{time}</div>
    </>
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
