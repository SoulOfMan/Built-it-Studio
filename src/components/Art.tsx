import { useEffect, useState } from 'react';

/** Cover art tile: shows the podcast image, falling back to coloured initials if missing, blocked or offline. */
export function Art({ img, ab, bg, className = 'art', style }: { img?: string; ab: string; bg: string; className?: string; style?: React.CSSProperties }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [img]);
  const src = img ? img.replace(/^http:\/\//i, 'https://') : '';
  return (
    <div className={className} style={{ background: bg, ...style }}>
      {src && !failed ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : ab}
    </div>
  );
}
