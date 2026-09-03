/**
 * Generate a standard RFC4122 compliant UUID v4 string.
 * Uses window.crypto.randomUUID() when available, with a bulletproof RFC4122 fallback.
 */
export function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    try {
      return window.crypto.randomUUID();
    } catch {
      // Fallback if browser security context restricts randomUUID
    }
  }

  // RFC4122 v4 compliant replacement
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
