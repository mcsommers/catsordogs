import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function Player({ url, onClose }: { url: string; onClose?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      return;
    }
    if (!Hls.isSupported()) return;
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [url]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Watch</h2>
        {onClose ? <button type="button" onClick={onClose}>Close</button> : null}
      </div>
      <p className="muted">This watch is not counted as a view, and the person is not told.</p>
      <video ref={ref} className="player" controls playsInline />
    </div>
  );
}
