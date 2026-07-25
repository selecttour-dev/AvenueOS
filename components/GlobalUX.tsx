"use client";

import { useEffect } from "react";

/** Small global UX guards that run once for the whole app.
 *
 *  1. Number inputs no longer change value when you scroll the mouse wheel
 *     over them — a common footgun that silently corrupts money fields.
 *     As soon as a wheel gesture starts, we blur the focused number input so
 *     the page scrolls normally and the value stays put.
 */
export default function GlobalUX() {
  useEffect(() => {
    const onWheel = () => {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement &&
        el.type === "number" &&
        !el.readOnly &&
        !el.disabled
      ) {
        el.blur();
      }
    };
    // passive: we only blur, never preventDefault — page scroll is untouched.
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);

  return null;
}
