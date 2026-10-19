import { useEffect, useState } from 'react';

/** Şu an (Unix sn); dakikada bir tazelenir (render sırasında `Date.now()` çağırmamak için). */
export function useNowSec(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
