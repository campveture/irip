import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

interface PublicHeroProps {
  eyebrow: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  inset?: boolean;
  artwork?: 'pages' | 'orbits' | 'paths';
  shortcuts?: ReadonlyArray<{ to: string; label: string; detail: string }>;
}

/** Editorial composition with lightweight artwork and real navigation, not cards. */
export function PublicHero({ eyebrow, title, description, actions, inset = false, artwork = 'pages', shortcuts = [] }: PublicHeroProps) {
  const heading = useId();
  return <section data-header-surface="forest" data-public-hero aria-labelledby={heading} className={`irip-editorial-hero bg-midnight text-white ${inset ? 'rounded-2xl' : ''}`}>
    <div className={inset ? 'px-6 sm:px-9' : 'container-page'}>
      <div className="irip-hero-composition">
        <div className="irip-hero-copy">
          <p className="irip-hero-eyebrow">{eyebrow}</p>
          <h1 id={heading} className="irip-hero-title">{title}</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/90">{description}</p>
          {actions && <div className="mt-8 flex flex-wrap items-center gap-4">{actions}</div>}
        </div>
        <div className="irip-hero-art" aria-hidden="true">
          <svg viewBox="0 0 420 380" fill="none" focusable="false">
            <circle cx="210" cy="190" r="151" stroke="currentColor" strokeOpacity=".14" />
            <path d="M22 190H398M210 14V366" stroke="currentColor" strokeOpacity=".12" strokeDasharray="2 8" />
            {artwork === 'pages' ? <g stroke="currentColor">{Array.from({ length: 12 }, (_, index) => <path key={index} d={`M210 303C${105 - index * 4} ${246 - index * 9} ${64 + index * 7} ${181 - index * 8} ${76 + index * 10} ${83 - index * 3}C${137 + index * 5} ${87 + index * 4} 179 ${140 + index * 5} 210 185C241 ${140 + index * 5} ${283 - index * 5} ${87 + index * 4} ${344 - index * 10} ${83 - index * 3}C${356 - index * 7} ${181 - index * 8} ${315 + index * 4} ${246 - index * 9} 210 303Z`} strokeOpacity={0.25 + index * 0.05} />)}</g> : artwork === 'orbits' ? <g stroke="currentColor">{[0, 30, 60, 90, 120, 150].map(angle => <ellipse key={angle} cx="210" cy="190" rx="155" ry="62" transform={`rotate(${angle} 210 190)`} strokeOpacity=".55" />)}<circle cx="210" cy="190" r="12" fill="currentColor" /></g> : <g stroke="currentColor">{Array.from({ length: 11 }, (_, index) => <path key={index} d={`M45 ${310 - index * 16}C140 ${320 - index * 22} 147 ${65 + index * 16} 245 ${85 + index * 16}S320 ${145 + index * 10} 380 ${55 + index * 19}`} strokeOpacity={0.25 + index * 0.06} />)}</g>}
            <path d="M319 35V59M307 47H331" stroke="var(--palette-paper)" strokeWidth="2" />
            <circle cx="86" cy="295" r="5" fill="var(--palette-paper)" />
          </svg>
        </div>
      </div>
      {shortcuts.length > 0 && <nav aria-label={`${eyebrow} shortcuts`} className="irip-hero-shortcuts">
        {shortcuts.map(shortcut => <Link key={shortcut.to} to={shortcut.to} className="irip-hero-shortcut"><span><span className="block text-xs text-brand-100">{shortcut.detail}</span><span className="mt-1 block text-sm font-semibold">{shortcut.label}</span></span><ArrowUpRight size={19} aria-hidden="true" /></Link>)}
      </nav>}
    </div>
  </section>;
}
