import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/** Animate the current view, not a cloned/stale view. No route keys or delayed
 * unmounts: auth revocations, form state and private-data boundaries stay intact.
 */
export function useRouteMotion(ref: RefObject<HTMLElement>) {
  const { pathname, hash } = useLocation();
  const previous = useRef(pathname);
  useLayoutEffect(() => {
    const changedPage = previous.current !== pathname;
    previous.current = pathname;
    const element = ref.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!changedPage || hash || preference.matches || !element || typeof element.animate !== 'function') return;
    const animation = element.animate([
      { opacity: 0.35, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 340, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    const cancelForPreference = () => { if (preference.matches) animation.cancel(); };
    preference.addEventListener('change', cancelForPreference);
    return () => { animation.cancel(); preference.removeEventListener('change', cancelForPreference); };
  }, [pathname, hash, ref]);
}
