import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/** Hide during intentional downward travel, then dock again after scroll settles.
 * Only threshold crossings update React; scroll work is passive and frame-batched.
 */
export function useHeaderDock(ref: RefObject<HTMLElement>, locked: boolean) {
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Measure actual navigation height (including resized text) so content and
  // anchor offsets never sit underneath the floating capsule.
  useLayoutEffect(() => {
    const container = ref.current?.querySelector<HTMLElement>(':scope > .container-page');
    const shell = ref.current?.closest<HTMLElement>('.irip-shell');
    if (!container || !shell) return;
    const measure = () => shell.style.setProperty('--irip-header-height', `${container.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => { observer.disconnect(); shell.style.removeProperty('--irip-header-height'); };
  }, [ref]);
  useEffect(() => {
    const header = ref.current;
    let previousY = Math.max(0, window.scrollY);
    let previousScrolled = previousY > 12;
    let previousHidden = false;
    let downwardTravel = 0;
    let idle = 0;
    let frame = 0;
    setHidden(false);
    setScrolled(previousScrolled);
    function reveal() {
      downwardTravel = 0;
      if (previousHidden) { previousHidden = false; setHidden(false); }
    }
    function update() {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const delta = y - previousY;
      previousY = y;
      const nextScrolled = y > 12;
      if (nextScrolled !== previousScrolled) { previousScrolled = nextScrolled; setScrolled(nextScrolled); }
      const interacting = locked || header?.contains(document.activeElement) || header?.querySelector('button[aria-expanded="true"]');
      if (y <= 120 || delta < 0 || interacting) { reveal(); return; }
      downwardTravel += delta;
      if (downwardTravel >= 18 && !previousHidden) { previousHidden = true; setHidden(true); }
    }
    function scroll() {
      window.clearTimeout(idle);
      idle = window.setTimeout(reveal, 260);
      if (!frame) frame = window.requestAnimationFrame(update);
    }
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', reveal);
    header?.addEventListener('focusin', reveal);
    return () => {
      window.clearTimeout(idle);
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', reveal);
      header?.removeEventListener('focusin', reveal);
    };
  }, [pathname, ref, locked]);
  return { hidden, scrolled };
}
