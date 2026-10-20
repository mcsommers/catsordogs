import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function Player({ url, onClose }: { url: string; onClose?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    setPlayError(null);
    const video = ref.current;
    if (!video) return;

    // Use hls.js whenever the browser can run it. Chrome 147 and later answers
    // canPlayType('application/vnd.apple.mpegurl') with "maybe", then fails to
    // play these streams natively. Cursor's browser does not claim that support,
    // so it already took this path and played. Native playback is only for
    // browsers that cannot run hls.js (Safari).
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, detail) => {
        if (detail.fatal) {
          setPlayError('The player could not load this video. The link may have expired; close and tap Watch again.');
        }
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
      };
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      const onVideoError = () => {
        setPlayError('The browser could not play this video. Close and tap Watch again.');
      };
      video.addEventListener('error', onVideoError);
      video.src = url;
      return () => video.removeEventListener('error', onVideoError);
    }

    setPlayError('This browser cannot play this video. Try Chrome or Safari.');
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
