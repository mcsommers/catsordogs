import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function Player({ url, onClose }: { url: string; onClose?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    setPlayError(null);
    const video = ref.current;
    if (!video) return;

    const onVideoError = () => {
      setPlayError('The browser could not play this video. Try Chrome or Safari, or use Watch again.');
    };
    video.addEventListener('error', onVideoError);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      void video.play().catch(() => {
        // Autoplay is blocked until the user taps play on the controls; that is normal.
      });
      video.load();
      return () => video.removeEventListener('error', onVideoError);
    }

    if (!Hls.isSupported()) {
      setPlayError('This browser cannot play HLS video. Try Chrome or Safari.');
      return () => video.removeEventListener('error', onVideoError);
    }

    const hls = new Hls();
    hls.on(Hls.Events.ERROR, (_event, detail) => {
      if (detail.fatal) {
        setPlayError('The player could not load this video. The link may have expired; close and tap Watch again.');
      }
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    return () => {
      video.removeEventListener('error', onVideoError);
      hls.destroy();
    };
  }, [url]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Watch</h2>
        {onClose ? <button type="button" onClick={onClose}>Close</button> : null}
      </div>
      <p className="muted">This watch is not counted as a view, and the person is not told. Tap play on the video if it does not start on its own.</p>
      {playError ? <p className="error">{playError}</p> : null}
      <video ref={ref} className="player" controls playsInline />
    </div>
  );
}
