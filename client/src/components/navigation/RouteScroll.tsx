import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { publicHeaderHeight } from './headerGeometry';

/** Route navigation scrolls to the destination, not the previous page's viewport.
 * Query-only catalog updates keep position; POP restoration stays browser-managed.
 */
export function RouteScroll() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef<{ pathname: string; hash: string } | null>(null);

  useLayoutEffect(() => {
    const last = previous.current;
    previous.current = { pathname, hash };
    const changedPage = !last || last.pathname !== pathname;
    if (!hash) {
      if (changedPage && (navigationType !== 'POP' || !last)) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.getElementById('route-content')?.focus({ preventScroll: true });
      }
      return;
    }

    // Leave a newly entered page at its top while its requested section is loading.
    if (changedPage) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    let id: string;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    let frame = 0;
    let timeout = 0;
    const container = document.getElementById('route-content') || document.body;
    const observer = new MutationObserver(findAndScroll);
    const resize = new ResizeObserver(findAndScroll);
    function findAndScroll(): boolean {
      const target = document.getElementById(id);
      if (!target) return false;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!target.isConnected) return;
        const stickySections = [...document.querySelectorAll<HTMLElement>('[data-scroll-offset]')]
          .filter(element => element.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING)
          .reduce((height, element) => height + element.getBoundingClientRect().height, 0);
        const offset = publicHeaderHeight() + stickySections + 16;
        window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset), left: 0, behavior: 'instant' });
        if (target instanceof HTMLElement) target.focus({ preventScroll: true });
      });
      return true;
    }
    function stop() {
      observer.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.removeEventListener(event, stop);
    }
    // Keep the target aligned through asynchronous content/image layout changes.
    // Stop immediately on user intent, so a late response cannot hijack their scrolling.
    observer.observe(container, { childList: true, subtree: true });
    resize.observe(container);
    findAndScroll();
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(event, stop, { passive: true });
    timeout = window.setTimeout(stop, 8000);
    return stop;
  }, [pathname, hash, key, navigationType]);

  return null;
}
