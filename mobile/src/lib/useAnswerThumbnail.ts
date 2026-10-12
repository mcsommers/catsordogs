import { useEffect, useState } from 'react';
import { fetchPlaybackForAnswer } from './feed';

/** Signed Mux poster for a live answer row (profile archive). Fails silently when playback is gated. */
export function useAnswerThumbnail(answerId: string, status: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'live') {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setUrl(null);
    fetchPlaybackForAnswer(answerId)
      .then((urls) => {
        if (!cancelled && urls.thumbnailUrl) setUrl(urls.thumbnailUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [answerId, status]);

  return url;
}
