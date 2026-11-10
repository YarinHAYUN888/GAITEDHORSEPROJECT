import { useRef, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const SWIPE_THRESHOLD = 80;
const SWIPE_VELOCITY = 0.3;

const ROUTE_ORDER = [
  "/",
  "/dashboard",
  "/gait-analysis",
  "/breeds",
  "/training-calendar",
];

export function useSwipeNavigation(containerRef?: React.RefObject<HTMLElement>) {
  const navigate = useNavigate();
  const location = useLocation();
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);

  const handleSwipe = useCallback(
    (deltaX: number, deltaY: number, elapsed: number) => {
      if (Math.abs(deltaY) > Math.abs(deltaX)) return; // vertical scroll
      if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
      const velocity = Math.abs(deltaX) / elapsed;
      if (velocity < SWIPE_VELOCITY) return;

      const currentIndex = ROUTE_ORDER.indexOf(location.pathname);
      if (currentIndex === -1) return;

      // RTL: swipe left = next, swipe right = prev
      const dir = document.documentElement.getAttribute("dir");
      const isRTL = dir === "rtl";
      const goNext = isRTL ? deltaX > 0 : deltaX < 0;

      const nextIndex = goNext ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex >= 0 && nextIndex < ROUTE_ORDER.length) {
        navigate(ROUTE_ORDER[nextIndex]);
        hapticTap();
      }
    },
    [location.pathname, navigate]
  );

  useEffect(() => {
    const el = containerRef?.current ?? document;

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      startTime.current = Date.now();
    };

    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      const elapsed = Date.now() - startTime.current;
      handleSwipe(dx, dy, elapsed);
    };

    el.addEventListener("touchstart", onTouchStart as EventListener, { passive: true });
    el.addEventListener("touchend", onTouchEnd as EventListener, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart as EventListener);
      el.removeEventListener("touchend", onTouchEnd as EventListener);
    };
  }, [handleSwipe, containerRef]);
}

// Minimal haptic tap
function hapticTap() {
  if ("vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

export function triggerHaptic(pattern: "tap" | "success" | "error" = "tap") {
  if (!("vibrate" in navigator)) return;
  switch (pattern) {
    case "tap":
      navigator.vibrate(10);
      break;
    case "success":
      navigator.vibrate([10, 50, 20]);
      break;
    case "error":
      navigator.vibrate([30, 30, 30, 30, 30]);
      break;
  }
}
