"use client";

import { RefObject, useCallback } from "react";

export function useOrientationLock() {
  const lockLandscape = useCallback(async () => {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void>; unlock?: () => void };
    if (!orientation?.lock) return false;
    try {
      await orientation.lock("landscape");
      return true;
    } catch {
      return false;
    }
  }, []);

  const unlock = useCallback(() => {
    const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void };
    try {
      orientation?.unlock?.();
    } catch {
      // Browser-specific restrictions are expected here.
    }
  }, []);

  return { lockLandscape, unlock };
}

export function useFullscreen(targetRef: RefObject<HTMLElement>, onLockFailed?: () => void) {
  const { lockLandscape, unlock } = useOrientationLock();

  const enter = useCallback(async () => {
    const el = targetRef.current;
    if (!el) return false;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      }
      const locked = await lockLandscape();
      if (!locked) onLockFailed?.();
      return true;
    } catch {
      onLockFailed?.();
      return false;
    }
  }, [lockLandscape, onLockFailed, targetRef]);

  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      unlock();
      return true;
    } catch {
      return false;
    }
  }, [unlock]);

  const toggle = useCallback(async () => {
    if (document.fullscreenElement) return exit();
    return enter();
  }, [enter, exit]);

  return { enter, exit, toggle };
}
