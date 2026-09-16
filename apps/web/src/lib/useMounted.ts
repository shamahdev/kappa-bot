import { useEffect, useState } from 'react';

/** True only after client hydration — gates auth-dependent chrome. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
