import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { EditSpot } from '../admin/preview/PreviewKit';
import { homePhotography } from './homePhotography';
import { DEFAULT_HOME, type HomeContent } from './publicContent';

/** Photographic academic composition. No carousel, new claim or simulated service. */
/** Text comes from Admin → Website content → Homepage; photo and captions stay fixed. */
/** EditSpot targets match the editor sections in admin/website/WebsiteContent.tsx; they render nothing on the public site. */
export function HomeHero({ hero = DEFAULT_HOME.hero }: { hero?: HomeContent['hero'] }) {
  return <section data-header-surface="forest" data-public-hero data-photographic-home aria-labelledby="home-hero-heading" className="irip-editorial-hero irip-home-hero">
    <div className="container-page">
      <div className="irip-home-hero-composition">
        <div className="min-w-0">
          <EditSpot target="home-hero" label="headline">
            <p className="irip-hero-eyebrow">{hero.eyebrow}</p>
            <h1 id="home-hero-heading" className="irip-hero-title">{hero.headline}{hero.headline_emphasis && <><br /><em>{hero.headline_emphasis}</em></>}</h1>
            <p className="irip-hero-lead mt-6 max-w-lg">{hero.lead}</p>
          </EditSpot>
          <EditSpot target="home-buttons" label="buttons">
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/programs" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-brand-900 transition hover:bg-white">{hero.primary_button} <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/70 px-5 text-sm font-medium text-white transition hover:border-white hover:bg-white/10">{hero.secondary_button}</a>
            </div>
          </EditSpot>
        </div>
        <figure className="irip-home-lead-photo">
          <img src={homePhotography.hero.src} srcSet={homePhotography.hero.srcSet} sizes="(min-width: 1280px) 520px, (min-width: 768px) 44vw, 100vw" width="1600" height="1067" loading="eager" decoding="async" alt={homePhotography.hero.alt} />
          <figcaption className="text-inverse">Illustrative study scene · Stock photo, not IRIP people or premises.</figcaption>
        </figure>
      </div>
      <nav aria-label="IRIP shortcuts" className="irip-hero-shortcuts">
        {hero.shortcuts.map((shortcut, index) => <EditSpot key={`${shortcut.link}-${index}`} target={`home-shortcut-${index}`} label={`shortcut ${index + 1}`} className="min-w-0">
          <Link to={shortcut.link} className="irip-hero-shortcut"><span><span className="block text-xs text-inverse">{shortcut.detail}</span><span className="mt-1 block text-sm font-semibold">{shortcut.label}</span></span><ArrowUpRight size={19} aria-hidden="true" /></Link>
        </EditSpot>)}
      </nav>
    </div>
  </section>;
}
