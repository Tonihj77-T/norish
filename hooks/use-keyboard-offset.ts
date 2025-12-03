"use client";

import { useEffect, useState } from "react";

/**
 * Hook that returns the current keyboard height offset using Visual Viewport API.
 * This is a fallback for browsers that don't support the VirtualKeyboard API (e.g., Safari on iOS).
 *
 * For browsers that support it, use CSS env(keyboard-inset-height) instead.
 *
 * @returns The keyboard height in pixels (0 when keyboard is hidden)
 */
export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    // Check if VirtualKeyboard API is supported - if yes, CSS will handle it
    if (typeof navigator !== "undefined" && "virtualKeyboard" in navigator) {
      return;
    }

    // Fallback: Use Visual Viewport API for browsers without VirtualKeyboard support
    if (!window.visualViewport) {
      return;
    }

    let rafId: number | null = null;

    const updateOffset = () => {
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;

        if (!window.visualViewport) return;

        // Calculate keyboard height as the difference between window height and visual viewport height
        // On iOS, when keyboard appears, visualViewport.height shrinks
        const keyboardHeight = Math.max(
          0,
          window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop
        );

        setOffset(keyboardHeight);
      });
    };

    // Listen for viewport changes
    window.visualViewport.addEventListener("resize", updateOffset);
    window.visualViewport.addEventListener("scroll", updateOffset);

    // Initial calculation
    updateOffset();

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.visualViewport?.removeEventListener("resize", updateOffset);
      window.visualViewport?.removeEventListener("scroll", updateOffset);
    };
  }, []);

  return offset;
}
