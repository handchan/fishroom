import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

/**
 * Registers the service worker and exposes whether a new version is waiting.
 * We deliberately don't auto-reload — `applyUpdate()` is called from an in-app
 * prompt so a refresh never interrupts the user mid-edit.
 */
export function useAppUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    updateRef.current = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
    });
  }, []);

  function applyUpdate() {
    setNeedRefresh(false);
    void updateRef.current?.(true);
  }

  return { needRefresh, applyUpdate };
}
