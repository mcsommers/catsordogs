import { useCallback, useEffect, useState } from 'react';

/** Resets to visible when the active clip changes (feed row or 06k answer). */
export function useVideoChromeVisibility(activeKey: string | null | undefined) {
  const [chromeVisible, setChromeVisible] = useState(true);

  useEffect(() => {
    setChromeVisible(true);
  }, [activeKey]);

  const toggleChromeVisibility = useCallback(() => {
    setChromeVisible((visible) => !visible);
  }, []);

  return { chromeVisible, toggleChromeVisibility, setChromeVisible };
}
