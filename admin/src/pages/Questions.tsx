import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { addUtcDays, formatDay, formatWhen, localToday, browserTimeZone } from '../dates';

type Question = { id: string; question_date: string; text: string; is_override: boolean };
type Override = { id: string; question_id: string; previous_text: string; new_text: string; overridden_at: string };
type AnswerCount = { question_id: string; answer_count: number };
type DayRow = { date: string; question?: Question };
type SortKey = 'date' | 'answers';

const PAGE_SIZES = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];
const WINDOW_DAYS = 30;

export default function Questions() {
  const today = localToday();
  const tomorrow = addUtcDays(today, 1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [showPast, setShowPast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aheadDate, setAheadDate] = useState(tomorrow);
  const [aheadText, setAheadText] = useState('');
  const [confirmSwap, setConfirmSwap] = useState<Question | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const [q, o, c] = await Promise.all([
      supabase.from('questions').select('id, question_date, text, is_override').order('question_date'),
      supabase.from('question_overrides').select('id, question_id, previous_text, new_text, overridden_at').order('overridden_at', { ascending: false }),
      supabase.rpc('admin_question_answer_counts'),
    ]);
    if (q.error || o.error || c.error) {
      setError(q.error?.message ?? o.error?.message ?? c.error?.message ?? 'Could not load the calendar.');
      return;
    }
    const loaded = q.data ?? [];
    setQuestions(loaded);
    setAheadDate(firstDateWithoutQuestion(addUtcDays(localToday(), 1), loaded));
    setOverrides(o.data ?? []);
    const next: Record<string, number> = {};
    for (const row of (c.data ?? []) as AnswerCount[]) next[row.question_id] = Number(row.answer_count);
    setCounts(next);
    setError(null);
  }, []);

  useEffect(() => {
    supabase.rpc('admin_set_time_zone', { p_time_zone: browserTimeZone() }).then(() => load());
  }, [load]);

  const byDate = new Map(questions.map((q) => [q.question_date, q]));
  const horizon = addUtcDays(today, WINDOW_DAYS);
  let lastUpcoming = horizon;
  for (const question of questions) {
    if (question.question_date > lastUpcoming) lastUpcoming = question.question_date;
  }
  const upcoming: DayRow[] = [];
  for (let date = today; date <= lastUpcoming; date = addUtcDays(date, 1)) {
    if (date <= horizon || byDate.has(date)) upcoming.push({ date, question: byDate.get(date) });
  }
  const past: DayRow[] = questions
    .filter((question) => question.question_date < today)
    .map((question) => ({ date: question.question_date, question }));

  const query = search.trim().toLowerCase();
  const filtered = (showPast ? past : upcoming).filter((row) => {
    if (!query) return true;
    return (row.question?.text ?? '').toLowerCase().includes(query);
  });
  const sorted = [...filtered].sort((a, b) => compareRows(a, b, sortKey, sortDir, counts));
  const filterKey = `${showPast}|${query}|${sortKey}|${sortDir}|${pageSize}`;
  useEffect(() => {
    setPage(1);
    setEditingId(null);
  }, [filterKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function goToPage(next: number) {
    setPage(next);
    setEditingId(null);
  }

  function showPrevious(next: boolean) {
    setShowPast(next);
    setSortKey('date');
    setSortDir(next ? 'desc' : 'asc');
    setEditingId(null);
  }

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'answers' ? 'desc' : 'asc');
  }

  function startEdit(row: DayRow) {
    const key = editKey(row);
    setEditingId(key);
    setDrafts((prev) => ({ ...prev, [key]: prev[key] ?? row.question?.text ?? '' }));
    setError(null);
  }

  function cancelEdit(key: string) {
    setEditingId(null);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function trySave(row: DayRow) {
    const key = editKey(row);
    const text = (drafts[key] ?? row.question?.text ?? '').trim();
    if (text.length < 1 || text.length > 200) {
      setError('Enter a question of 1 to 200 characters.');
      return;
    }
    const question = row.question;
    if (question && (counts[question.id] ?? 0) > 0 && text !== question.text) {
      setConfirmSwap(question);
      return;
    }
    void commit(row, text);
  }

  async function commit(row: DayRow, text: string) {
    setError(null);
    if (!row.question) {
      const { error: saveError } = await supabase.from('questions').insert({ question_date: row.date, text });
      if (saveError) return setError(saveError.message);
    } else {
      const { error: saveError } = await supabase.from('questions').update({ text }).eq('id', row.question.id);
      if (saveError) return setError(saveError.message);
    }
    setEditingId(null);
    await load();
  }

  async function addAhead(date: string, text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 1 || trimmed.length > 200) {
      setError('Enter a question of 1 to 200 characters.');
      return;
    }
    setError(null);
    const { error: saveError } = await supabase.from('questions').insert({ question_date: date, text: trimmed });
    if (saveError) return setError(saveError.message);
    setAheadText('');
    await load();
  }

  return (
    <div>
      <h2>Question calendar</h2>
      <p className="muted">
        One question per calendar day. Days follow your own local calendar, so today flips at your midnight.
        This page opens on today and the next 30 days. A day with no question is highlighted in red.
        A past question cannot be changed or removed. Today can be swapped, not deleted.
        Each swap is kept here and is never shown in the phone app.
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => showPrevious(!showPast)}>
          {showPast ? 'Hide previous questions' : 'Show previous questions'}
        </button>
        <label>
          Search
          <input
            value={search}
            placeholder="Search questions"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {!showPast && !byDate.has(tomorrow) ? (
        <div className="banner">
          No question is scheduled for tomorrow ({formatDay(tomorrow)}). Every admin gets one email about that,
          until a question is added.
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {sorted.length > 0 ? (
        <div className="table-wrap">
          <table className="sheet questions">
            <thead>
              <tr>
                <SortableHeader label="Date" column="date" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                <th>Day</th>
                <th>Question</th>
                <SortableHeader label="Answers" column="answers" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} numeric />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const question = row.question;
                const when = row.date < today ? 'past' : row.date === today ? 'today' : 'future';
                const key = editKey(row);
                const editing = editingId === key;
                const count = question ? counts[question.id] ?? 0 : 0;
                const history = question ? overrides.filter((item) => item.question_id === question.id) : [];
                const classes = [row.date === today ? 'lead' : '', !question ? 'empty' : ''].filter(Boolean).join(' ');
                return (
                  <tr key={row.date} className={classes || undefined}>
                    <td>
                      <div>{formatQuestionDate(row.date)}</div>
                      {question?.is_override ? <span className="tag">Swapped</span> : null}
                    </td>
                    <td>{formatWeekday(row.date)}</td>
                    <td className="question">
                      {editing ? (
                        <div className="stack">
                          <textarea
                            maxLength={200}
                            value={drafts[key] ?? ''}
                            aria-label={`Question for ${formatQuestionDate(row.date)}`}
                            onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })}
                          />
                          <div className="row">
                            <button className="primary" type="button" onClick={() => trySave(row)}>Save</button>
                            <button type="button" onClick={() => cancelEdit(key)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="question-line">
                            {question ? question.text : 'No question'}
                            {when !== 'past' ? (
                              <button type="button" className="text-link" onClick={() => startEdit(row)}>Edit</button>
                            ) : null}
                          </p>
                          {history.length > 0 ? (
                            <ul className="history">
                              {history.map((item) => (
                                <li key={item.id}>
                                  {formatWhen(item.overridden_at)}: "{item.previous_text}" to "{item.new_text}"
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="num">
                      <Link to={`/videos?from=${row.date}&to=${row.date}`}>{count}</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">{emptyMessage(showPast, query, past.length)}</p>
      )}
      {sorted.length > 0 ? (
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
      {!showPast ? (
        <form
          className="card stack"
          style={{ marginTop: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            void addAhead(aheadDate, aheadText);
          }}
        >
          <h2>Schedule further ahead</h2>
          <div className="grid">
            <label>
              Date (your local calendar)
              <input type="date" value={aheadDate} min={today} onChange={(e) => setAheadDate(e.target.value)} required />
            </label>
            <label>
              Question (1 to 200 characters)
              <input value={aheadText} maxLength={200} onChange={(e) => setAheadText(e.target.value)} required />
            </label>
          </div>
          <button className="primary" type="submit">Add question</button>
        </form>
      ) : null}
      {confirmSwap ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="swap-modal-title">
            <h3 id="swap-modal-title">Change a question that has answers?</h3>
            <p>
              {answeredLabel(counts[confirmSwap.id] ?? 0)} this question. Their videos stay as they are, but
              everywhere in the app they will now appear to answer the new wording, not the original.
            </p>
            <p><strong>Original:</strong> {confirmSwap.text}</p>
            <p><strong>New:</strong> {(drafts[confirmSwap.id] ?? confirmSwap.text).trim()}</p>
            <div className="row">
              <button type="button" onClick={() => setConfirmSwap(null)}>Cancel</button>
              <button
                type="button"
                className="primary"
                onClick={async () => {
                  const question = confirmSwap;
                  const text = (drafts[question.id] ?? question.text).trim();
                  setConfirmSwap(null);
                  await commit({ date: question.question_date, question }, text);
                }}
              >
                Change question
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  numeric = false,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  numeric?: boolean;
}) {
  const active = sortKey === column;
  return (
    <th className={numeric ? 'num' : undefined}>
      <button
        type="button"
        className="sort"
        onClick={() => onSort(column)}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
}

function formatQuestionDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

function formatWeekday(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function editKey(row: DayRow): string {
  return row.question?.id ?? `empty:${row.date}`;
}

function compareRows(
  a: DayRow,
  b: DayRow,
  sortKey: SortKey,
  sortDir: 'asc' | 'desc',
  counts: Record<string, number>,
): number {
  if (sortKey === 'answers') {
    const diff = answerCount(a, counts) - answerCount(b, counts);
    if (diff !== 0) return sortDir === 'asc' ? diff : -diff;
  }
  const byDate = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  return sortDir === 'desc' && sortKey === 'date' ? -byDate : byDate;
}

function answerCount(row: DayRow, counts: Record<string, number>): number {
  return row.question ? counts[row.question.id] ?? 0 : 0;
}

function answeredLabel(count: number): string {
  return count === 1 ? '1 person answered' : `${count} people answered`;
}

/** First calendar day from start onward with no question row (start is usually tomorrow). */
function firstDateWithoutQuestion(start: string, questions: Question[]): string {
  const taken = new Set(questions.map((q) => q.question_date));
  let date = start;
  while (taken.has(date)) date = addUtcDays(date, 1);
  return date;
}

function emptyMessage(showPast: boolean, query: string, pastCount: number): string {
  if (query) return 'No questions match this search.';
  if (showPast && pastCount === 0) return 'No previous questions.';
  return 'No questions in this list.';
}
