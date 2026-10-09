import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { formatDay, formatWhen } from '../dates';
import Player from '../Player';

type Item = {
  id: string;
  kind: 'answer' | 'profile' | 'message';
  high_priority: boolean;
  report_count: number;
  answer_id: string | null;
  target_user_id: string | null;
  message_id: string | null;
  snapshot: { first_name?: string; question_text?: string; body?: string; account_deleted?: boolean };
  opened_at: string;
};

type Photo = { position: number; storage_path: string };

type AnswerContent = {
  kind: 'answer';
  gone?: boolean;
  answer_id: string;
  video_status: string;
  caption_text: string | null;
  duration_seconds: number | null;
  question_text: string | null;
  question_date: string | null;
  first_name: string | null;
  email: string | null;
};

type ProfileContent = {
  kind: 'profile';
  gone?: boolean;
  id: string;
  email: string | null;
  first_name: string | null;
  birthday: string | null;
  age: number | null;
  gender: string | null;
  pronouns: string[] | null;
  sexual_orientation: string[] | null;
  height_cm: number | null;
  city: string | null;
  job_title: string | null;
  company: string | null;
  school: string | null;
  about_me: string | null;
  lifestyle_tags: string[] | null;
  languages: string[] | null;
  interests: string[] | null;
  relationship_goal: string | null;
  allow_followers: boolean | null;
  photos: Photo[];
};

type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string | null;
  body: string;
  created_at: string;
  reported: boolean;
};

type MessageContent = {
  kind: 'message';
  gone?: boolean;
  sender_name: string | null;
  other_name: string | null;
  messages: ChatMessage[];
};

type Content = AnswerContent | ProfileContent | MessageContent;

const filters = [
  ['all', 'All'],
  ['answer', 'Videos'],
  ['profile', 'Profiles'],
  ['message', 'Chats'],
] as const;

export default function Queue() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [watchUrl, setWatchUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc('get_moderation_queue');
    if (loadError) return setError(loadError.message);
    setItems((data ?? []) as Item[]);
    setError(null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = filter === 'all' ? items : items.filter((item) => item.kind === filter);

  async function open(item: Item) {
    if (openId === item.id) {
      setOpenId(null);
      setContent(null);
      setWatchUrl(null);
      return;
    }
    setError(null);
    setWatchUrl(null);
    setOpenId(item.id);
    setContent(null);
    const { data, error: loadError } = await supabase.rpc('admin_queue_item_content', { p_id: item.id });
    if (loadError) return setError(loadError.message);
    const next = data as Content;
    setContent(next);
    if (next?.kind === 'profile' && !next.gone) {
      const urls = { ...photoUrls };
      for (const photo of next.photos ?? []) {
        if (urls[photo.storage_path]) continue;
        const signed = await supabase.storage.from('profile-photos').createSignedUrl(photo.storage_path, 3600);
        if (signed.data?.signedUrl) urls[photo.storage_path] = signed.data.signedUrl;
      }
      setPhotoUrls(urls);
    }
    if (next?.kind === 'answer' && !next.gone && item.answer_id && next.video_status === 'ready') {
      const { data: play } = await supabase.functions.invoke('get-playback-url', {
        body: { as_admin: true, answer_id: item.answer_id },
      });
      if (play?.playback_url) setWatchUrl(play.playback_url);
    }
  }

  async function decide(id: string, decision: 'restore' | 'keep' | 'reviewed') {
    const { error: saveError } = await supabase.rpc('review_queue_item', { p_id: id, p_decision: decision });
    if (saveError) return setError(saveError.message);
    if (openId === id) {
      setOpenId(null);
      setContent(null);
      setWatchUrl(null);
    }
    await load();
  }

  return (
    <div>
      <h2>Review queue</h2>
      <p className="muted">
        Open an item to review the actual content before you decide. A hidden video can be put back
        or left hidden. A profile or message report can be marked reviewed. Nothing here hides an
        account. Profiles reported by many different people are listed first. Once you decide, the
        item leaves this list.
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'primary' : undefined}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {items.length === 0 ? <p className="muted">Nothing is waiting.</p> : null}
      {items.length > 0 && shown.length === 0 ? (
        <p className="muted">Nothing of that type is waiting.</p>
      ) : null}
      {shown.map((item) => (
        <article className="card" key={item.id}>
          <div className="row">
            <span className="tag">{item.kind === 'answer' ? 'Hidden video' : item.kind === 'profile' ? 'Profile report' : 'Message report'}</span>
            {item.high_priority ? <span className="tag hot">High priority</span> : null}
            <span className="muted">{item.report_count} report{item.report_count === 1 ? '' : 's'} · {formatWhen(item.opened_at)}</span>
          </div>
          <p>
            <strong>{item.snapshot.first_name ?? 'Unknown'}</strong>
            {item.snapshot.account_deleted ? ' (account deleted)' : ''}
            {item.kind === 'answer' && item.snapshot.question_text ? ` · ${item.snapshot.question_text}` : ''}
            {item.kind === 'message' && item.snapshot.body ? ` · ${item.snapshot.body}` : ''}
          </p>
          <div className="row">
            <button type="button" onClick={() => open(item)}>
              {openId === item.id ? 'Hide content' : 'Review content'}
            </button>
            {item.kind === 'answer' ? (
              <>
                <button className="primary" type="button" onClick={() => decide(item.id, 'restore')}>Put back</button>
                <button type="button" onClick={() => decide(item.id, 'keep')}>Keep hidden</button>
              </>
            ) : (
              <button className="primary" type="button" onClick={() => decide(item.id, 'reviewed')}>Mark reviewed</button>
            )}
          </div>
          {openId === item.id ? (
            <ReviewPane content={content} photoUrls={photoUrls} watchUrl={watchUrl} />
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ReviewPane({
  content, photoUrls, watchUrl,
}: {
  content: Content | null;
  photoUrls: Record<string, string>;
  watchUrl: string | null;
}) {
  if (!content) return <p className="muted">Loading the reported content…</p>;
  if (content.gone) {
    return <p className="muted">This content is gone (the account may have been deleted). The name kept with the report is still above.</p>;
  }
  if (content.kind === 'answer') {
    return (
      <div className="stack" style={{ marginTop: 12 }}>
        <p>
          {content.first_name ?? 'Unknown'} {content.email ? `· ${content.email}` : ''}
          {content.question_date ? ` · ${formatDay(content.question_date)}` : ''}
        </p>
        <p>Question: {content.question_text ?? '—'}</p>
        {content.caption_text ? <p>Caption: {content.caption_text}</p> : null}
        {watchUrl ? (
          <Player url={watchUrl} />
        ) : (
          <p className="muted">
            {content.video_status === 'ready'
              ? 'The player could not load this file. The question and caption are still above. Watching here does not count as a view.'
              : `This recording is not ready to watch (${content.video_status}).`}
          </p>
        )}
      </div>
    );
  }
  if (content.kind === 'profile') {
    return (
      <div className="stack" style={{ marginTop: 12 }}>
        <p>{content.first_name ?? 'Unknown'}{content.age != null ? `, ${content.age}` : ''} {content.email ? `· ${content.email}` : ''}</p>
        <div className="photos">
          {(content.photos ?? []).length === 0 ? <span className="muted">No photos</span> : null}
          {(content.photos ?? []).map((photo) => (
            photoUrls[photo.storage_path]
              ? <img key={photo.storage_path} src={photoUrls[photo.storage_path]} alt={`Photo ${photo.position}`} />
              : <span key={photo.storage_path} className="muted">Photo {photo.position} unavailable</span>
          ))}
        </div>
        {content.about_me
          ? <p><strong>About Me</strong><br />{content.about_me}</p>
          : <p className="muted">No About Me</p>}
        <p>
          {line('Gender', content.gender)}
          {line('Pronouns', (content.pronouns ?? []).join(', '))}
          {line('Orientation', (content.sexual_orientation ?? []).join(', '))}
          {line('Height', content.height_cm ? `${content.height_cm} cm` : null)}
          {line('City', content.city)}
          {line('Job', [content.job_title, content.company].filter(Boolean).join(' at ') || null)}
          {line('School', content.school)}
          {line('Lifestyle', (content.lifestyle_tags ?? []).join(', '))}
          {line('Languages', (content.languages ?? []).join(', '))}
          {line('Interests', (content.interests ?? []).join(', '))}
          {line('Relationship goal', content.relationship_goal)}
          {line('Allow followers', content.allow_followers == null ? null : content.allow_followers ? 'Yes' : 'No')}
          {line('Birthday', content.birthday)}
        </p>
      </div>
    );
  }
  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <p className="muted">Chat between {content.sender_name ?? 'Unknown'} and {content.other_name ?? 'Unknown'}. The reported message is highlighted.</p>
      {(content.messages ?? []).length === 0 ? <p className="muted">No messages left in this chat.</p> : null}
      {(content.messages ?? []).map((message) => (
        <div key={message.id} className={message.reported ? 'card today' : 'card'} style={{ marginBottom: 8 }}>
          <div className="row">
            <strong>{message.sender_name ?? 'Unknown'}</strong>
            {message.reported ? <span className="tag hot">Reported</span> : null}
            <span className="muted">{formatWhen(message.created_at)}</span>
          </div>
          <p>{message.body}</p>
        </div>
      ))}
    </div>
  );
}

function line(label: string, value: string | null | undefined) {
  if (!value) return null;
  return <span key={label}>{label}: {value}<br /></span>;
}
