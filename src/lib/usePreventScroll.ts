'use client';
import { useEffect } from 'react';

/**
 * Hook to lock scrolling on document body, root documentElement,
 * and all <main> layout containers whenever a menu, sidebar drawer,
 * or modal is open. Restores original scroll states when closed.
 */
export function usePreventScroll(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalDocOverflow = document.documentElement.style.overflow;
    const mainEls = document.querySelectorAll('main');
    const originalMainOverflows: string[] = [];

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    mainEls.forEach((el, i) => {
      originalMainOverflows[i] = (el as HTMLElement).style.overflow;
      (el as HTMLElement).style.overflow = 'hidden';
    });

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalDocOverflow;
      mainEls.forEach((el, i) => {
        (el as HTMLElement).style.overflow = originalMainOverflows[i] || '';
      });
    };
  }, [isOpen]);
}
