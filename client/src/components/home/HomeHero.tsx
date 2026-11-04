import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { homePhotography } from './homePhotography';

const shortcuts = [
  { to: '/programs/research-bootcamp#cohorts', detail: 'Plan your start', label: 'Bootcamp intakes' },
  { to: '/courses', detail: 'Find your focus', label: 'Explore courses' },
  { to: '/projects', detail: 'See the practice', label: 'Research projects' },
] as const;

/** Photographic academic composition. No carousel, new claim or simulated service. */
export function HomeHero() {
  return <section data-header-surface="forest" data-public-hero data-photographic-home aria-labelledby="home-hero-heading" className="irip-editorial-hero irip-home-hero">
    <div className="container-page">
      <div className="irip-home-hero-composition">
        <div className="min-w-0">
          <p className="irip-hero-eyebrow">IRIP</p>
          <h1 id="home-hero-heading" className="irip-hero-title">Start with a question.<br /><em>Build the answer.</em></h1>
          <p className="irip-hero-lead mt-6 max-w-lg">Research learning, guided practice and proposed projects for Bangladesh.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/programs" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-brand-900 transition hover:bg-white">Explore programs <ArrowUpRight size={18} aria-hidden="true" /></Link>
            <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/70 px-5 text-sm font-medium text-white transition hover:border-white hover:bg-white/10">How it works</a>
          </div>
        </div>
        <figure className="irip-home-lead-photo">
          <img src={homePhotography.hero.src} srcSet={homePhotography.hero.srcSet} sizes="(min-width: 1280px) 520px, (min-width: 768px) 44vw, 100vw" width="1600" height="1067" loading="eager" decoding="async" alt={homePhotography.hero.alt} />
          <figcaption className="text-inverse">Illustrative study scene · Stock photo, not IRIP people or premises.</figcaption>
        </figure>
      </div>
      <nav aria-label="IRIP shortcuts" className="irip-hero-shortcuts">
        {shortcuts.map(shortcut => <Link key={shortcut.to} to={shortcut.to} className="irip-hero-shortcut"><span><span className="block text-xs text-inverse">{shortcut.detail}</span><span className="mt-1 block text-sm font-semibold">{shortcut.label}</span></span><ArrowUpRight size={19} aria-hidden="true" /></Link>)}
      </nav>
    </div>
  </section>;
}
