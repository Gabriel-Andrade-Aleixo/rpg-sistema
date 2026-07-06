import { useState } from 'react';

export default function RpgImage({ src, alt = '', className = '', fallback = '◇' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={`imageFallback ${className}`} aria-label={alt}>{fallback}</div>;
  return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />;
}
