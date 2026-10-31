import { Link } from 'react-router-dom';
import { ArrowUpRight, Users } from 'lucide-react';
import { programImage } from '../../lib/demoImages';
import { Surface } from '../shared/Surface';
import type { Program } from './types';

export function ProgramCard({ program }: { program: Program }) {
  return <Surface className="group flex h-full flex-col overflow-hidden transition hover:border-brand-300 hover:shadow-card">
    <Link to={`/programs/${program.slug}`} aria-label={`Explore ${program.title}`} className="block overflow-hidden">
      <img src={programImage(program)} alt="" width="1000" height="620" loading="lazy" className="aspect-[50/31] w-full object-cover transition duration-300 motion-safe:group-hover:scale-[1.02]" />
    </Link>
    <div className="flex flex-1 flex-col p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap gap-2 text-xs font-medium text-brand-800">
        {[program.domain, program.level].filter(Boolean).map((tag, index) => <span key={`${tag}-${index}`} className="rounded-full bg-brand-50 px-3 py-1">{tag}</span>)}
      </div>
      <h3 className="text-xl font-semibold leading-7 tracking-tight text-brand-900"><Link to={`/programs/${program.slug}`} className="hover:underline">{program.title}</Link></h3>
      <p className="mb-6 mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{program.summary}</p>
      <div className="mt-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700"><span>Proposed {program.currency} {program.fee.toLocaleString('en-BD')}</span><span className="inline-flex items-center gap-1.5"><Users size={15} aria-hidden="true" />{program.capacity} planned seats</span></div>
        <p className="mt-3 text-xs leading-5 text-slate-500">Pending approval. No live enrollment or payment.</p>
        <Link to={`/programs/${program.slug}`} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-brand-200 px-4 text-sm font-semibold text-brand-800 transition hover:bg-brand-900 hover:text-white">View details <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
    </div>
  </Surface>;
}
