import { useEffect, useRef, useCallback } from 'react';

/**
 * Returns a debounced version of `fn` that delays invoking it until after
 * `delay` milliseconds have elapsed since the last invocation.
 *
 * Per spec: debounce canvas saves by 1500 ms.
 */
export function useDebounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);

  // Keep ref up to date without resetting the debounce timer
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
      }, delay);
    },
    [delay]
  );
}
