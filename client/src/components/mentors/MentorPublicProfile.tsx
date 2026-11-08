import { Link } from 'react-router-dom';
import { ArrowRight, CircleAlert, ExternalLink, GraduationCap, Languages, Microscope } from 'lucide-react';
import { LANGUAGE_LABEL, LINK_KINDS, LINK_LABEL, splitTags, type PublicMentor } from '../mentor/mentorProfileModel';

export const initials = (name: string) => name.replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';

/**
 * The public mentor profile body, shared by /mentors/:slug and the live preview
 * in "My mentor profile" so the preview is exactly what visitors see.
 */
export default function MentorPublicProfile({ mentor }: { mentor: PublicMentor }) {
  const tags = splitTags(mentor.expertise);
  const links = LINK_KINDS.filter(kind => mentor.links[kind]);
  return <>
    <section className="bg-brand-900 text-white"><div className="container-page grid gap-8 py-14 sm:py-20 lg:grid-cols-[1fr_.5fr] lg:items-center">
      <div>
        <p className="eyebrow !text-brand-300">Mentor directory / Demo profile</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">{mentor.full_name || 'Your display name'}</h1>
        {mentor.headline && <p className="mt-4 text-lg font-medium text-brand-200">{mentor.headline}</p>}
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">Explore this mentor’s background and areas of expertise in the local demo.</p>
      </div>
      <figure className="flex aspect-[4/5] max-h-[420px] w-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-brand-800">
        <div className="flex flex-1 items-center justify-center"><span aria-hidden="true" className="flex h-40 w-40 items-center justify-center rounded-full bg-brand-200 text-5xl font-semibold text-brand-900">{initials(mentor.full_name)}</span></div>
        <figcaption className="px-4 py-3 text-xs text-white/75">Initials shown instead of a photo</figcaption>
      </figure>
    </div></section>
    <section className="container-page grid gap-8 py-14 sm:py-20 lg:grid-cols-[1fr_.65fr]" aria-labelledby="mentor-overview">
      <div>
        <p className="eyebrow">About the mentor</p>
        <h2 id="mentor-overview" className="mt-3 text-3xl font-semibold tracking-tight text-brand-900">Guidance grounded in practice.</h2>
        <p className="mt-5 whitespace-pre-line text-base leading-8 text-slate-700">{mentor.bio || 'A public biography has not yet been provided.'}</p>
        {mentor.qualifications.length > 0 && <div className="mt-8">
          <h3 className="text-lg font-semibold text-brand-900">Qualifications</h3>
          <ul className="mt-3 space-y-2">{mentor.qualifications.map((q, i) => <li key={i} className="text-sm leading-6 text-slate-700"><span className="font-semibold text-slate-900">{q.degree}</span> · {q.institution}{q.year ? ` · ${q.year}` : ''}</li>)}</ul>
        </div>}
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><CircleAlert size={18} className="mb-2" />Synthetic demo profile. Credentials and agreements have not been independently verified for publication. Mentor assignments are not booked from this page.</div>
      </div>
      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-6">
        <GraduationCap size={24} className="text-brand-700" />
        <h2 className="mt-5 text-lg font-semibold text-brand-900">Areas of expertise</h2>
        {tags.length ? <ul className="mt-3 flex flex-wrap gap-2">{tags.map(tag => <li key={tag} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-900">{tag}</li>)}</ul> : <p className="mt-3 text-sm leading-7 text-slate-700">To be confirmed</p>}
        {mentor.language && <p className="mt-5 flex items-center gap-2 text-sm text-slate-700"><Languages size={16} className="text-brand-700" /> Teaches in {LANGUAGE_LABEL[mentor.language]}</p>}
        {links.length > 0 && <ul className="mt-5 space-y-2">{links.map(kind => <li key={kind}><a href={mentor.links[kind]} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">{LINK_LABEL[kind]} <ExternalLink size={14} /><span className="sr-only">(opens in a new tab)</span></a></li>)}</ul>}
        <div className="mt-6 border-t border-slate-100 pt-6">
          <p className="text-sm text-slate-600">Interested in the learning experience?</p>
          <Link to="/programs" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white transition hover:bg-brand-800">Explore programs <ArrowRight size={16} /></Link>
          <Link to="/projects" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><Microscope size={16} /> See proposed projects</Link>
        </div>
      </aside>
    </section>
  </>;
}
