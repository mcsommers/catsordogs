import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { addUtcDays, formatDay, formatWhen, localToday, browserTimeZone } from '../dates';

type Question = { id: string; question_date: string; text: string; is_override: boolean };
type Override = { id: string; question_id: string; previous_text: string; new_text: string; overridden_at: string };
type AnswerCount = { question_id: string; answer_count: number };

export default function Questions() {
  const today = localToday();
  const tomorrow = addUtcDays(today, 1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [showPast, setShowPast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [aheadDate, setAheadDate] = useState(addUtcDays(today, 21));
  const [aheadText, setAheadText] = useState('');
  const [confirmSwap, setConfirmSwap] = useState<Question | null>(null);

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
    setQuestions(q.data ?? []);
    setOverrides(o.data ?? []);
    const next: Record<string, number> = {};
    for (const row of (c.data ?? []) as AnswerCount[]) next[row.question_id] = Number(row.answer_count);
    setCounts(next);
    setError(null);
  }, []);

  useEffect(() => {
    // Tell the server which calendar day this admin is on before it applies the calendar rules.
    supabase.rpc('admin_set_time_zone', { p_time_zone: browserTimeZone() }).then(() => load());
  }, [load]);

  const byDate = new Map(questions.map((q) => [q.question_date, q]));
  const past = questions
    .map((q) => q.question_date)
    .filter((date) => date < today)
    .sort()
    .reverse();
  let lastUpcoming = addUtcDays(today, 21);
  for (const question of questions) {
    if (question.question_date > lastUpcoming) lastUpcoming = question.question_date;
  }
  const upcoming: string[] = [];
  for (let date = addUtcDays(today, 1); date <= lastUpcoming; date = addUtcDays(date, 1)) {
    upcoming.push(date);
  }
  const days = showPast ? past : [today, ...upcoming];
  const hasPast = past.length > 0;

  function trySave(question: Question) {
    const answered = counts[question.id] ?? 0;
    const text = (drafts[question.id] ?? question.text).trim();
    if (answered > 0 && text !== question.text) {
      setConfirmSwap(question);
      return;
    }
    saveText(question);
  }

  async function saveText(question: Question) {
    const text = (drafts[question.id] ?? question.text).trim();
    const { error: saveError } = await supabase.from('questions').update({ text }).eq('id', question.id);
    if (saveError) return setError(saveError.message);
    await load();
  }

  async function add(date: string, text: string) {
    const { error: saveError } = await supabase.from('questions').insert({ question_date: date, text: text.trim() });
    if (saveError) return setError(saveError.message);
    setAheadText('');
    await load();
  }

  async function remove(id: string) {
    const { error: saveError } = await supabase.from('questions').delete().eq('id', id);
    if (saveError) return setError(saveError.message);
    await load();
  }

  return (
    <div>
      <h2>Question calendar</h2>
      <p className="muted">
        One question per calendar day. Days follow your own local calendar, so “today” flips at your midnight. You can schedule ahead and swap today.
        A past question cannot be changed or removed. Today can be swapped, not deleted.
        Each swap is kept here and is never shown in the phone app.
        This page opens on today and the days ahead.
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => setShowPast((open) => !open)}>
          {showPast ? 'Hide previous questions' : 'Show previous questions'}
        </button>
      </div>
      {showPast && !hasPast ? <p className="muted">No previous questions.</p> : null}
      {!showPast && !byDate.has(tomorrow) ? (
        <div className="banner">
          No question is scheduled for tomorrow ({formatDay(tomorrow)}). Every admin gets one email about that,
          until a question is added.
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {days.map((date) => {
        const question = byDate.get(date);
        const when = date < today ? 'past' : date === today ? 'today' : 'future';
        const missing = when === 'future' && !question;
        const history = question ? overrides.filter((o) => o.question_id === question.id) : [];
        const cardClass = ['card', when === 'today' ? 'today' : '', missing ? 'missing' : ''].filter(Boolean).join(' ');
        return (
          <article className={cardClass} key={date}>
            <div className="row">
              <strong>{formatDay(date)}</strong>
              {when === 'today' ? <span className="tag">Today</span> : null}
              {when === 'past' ? <span className="tag locked">Past · locked</span> : null}
              {question?.is_override ? <span className="tag">Swapped</span> : null}
              {!question ? <span className="tag">Empty</span> : null}
              {question && when !== 'future' ? (
                <span className="muted">{answeredLabel(counts[question.id] ?? 0)}</span>
              ) : null}
              {question && (counts[question.id] ?? 0) > 0 ? (
                <Link className="ghost" to={`/videos?from=${date}&to=${date}`}>View videos</Link>
              ) : null}
            </div>
            {question && when !== 'past' ? (
              <div className="stack" style={{ marginTop: 8 }}>
                <textarea
                  maxLength={200}
                  value={drafts[question.id] ?? question.text}
                  onChange={(e) => setDrafts({ ...drafts, [question.id]: e.target.value })}
                />
                <div className="row">
                  <button className="primary" type="button" onClick={() => trySave(question)}>Save swap</button>
                  {when === 'future' ? (
                    <button type="button" onClick={() => remove(question.id)}>Remove this future question</button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {question && when === 'past' ? <p>{question.text}</p> : null}
            {!question ? <AddDay onAdd={(text) => add(date, text)} /> : null}
            {history.length > 0 ? (
              <ul className="muted">
                {history.map((item) => (
                  <li key={item.id}>
                    {formatWhen(item.overridden_at)}: “{item.previous_text}” → “{item.new_text}”
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
      {!showPast ? (
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          add(aheadDate, aheadText);
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
                  setConfirmSwap(null);
                  await saveText(question);
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

function answeredLabel(count: number): string {
  return count === 1 ? '1 person answered' : `${count} people answered`;
}

function AddDay({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form
      className="stack"
      style={{ marginTop: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(text);
        setText('');
      }}
    >
      <textarea
        value={text}
        maxLength={200}
        placeholder="Question text"
        aria-label="Question text"
        required
        onChange={(e) => setText(e.target.value)}
      />
      <button className="primary" type="submit">Add</button>
    </form>
  );
}
