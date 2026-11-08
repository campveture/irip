import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { actionClass, fieldClass, secondaryClass } from '../../accounts/accountModel';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { AdminPage, Feedback, ResourceView, cardClass } from '../AdminShared';
import { LIMITS, STATUS_LABELS, filterPrograms, formatTaka, parseProgramList, slugProblem, slugify, type PublishStatus } from './programsModel';

export function StatusBadge({ status }: { status: PublishStatus }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status === 'published' ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'}`}>
    <span aria-hidden="true" className="mr-1.5">{status === 'published' ? '●' : '○'}</span>{STATUS_LABELS[status]}
  </span>;
}

function NewProgram({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(''), [slug, setSlug] = useState(''), [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const address = slugTouched ? slug : slugify(title);
  const titleProblem = title.trim().length > 0 && (title.trim().length < 3 || title.trim().length > LIMITS.title) ? `Use 3–${LIMITS.title} characters.` : null;
  const addressProblem = address ? slugProblem(address) : null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim().length < 3 || addressProblem) return;
    setBusy(true); setError('');
    try {
      const created = await api.post('/admin/curriculum/programs', { title: title.trim(), slug: address }) as { id?: unknown };
      if (typeof created.id !== 'number') throw new Error('The new program could not be opened. Reload the list.');
      navigate(`/admin/programs/${created.id}`);
    } catch (e) { setError(errorMessage(e)); setBusy(false); }
  }
  return <form onSubmit={submit} className={cardClass} aria-labelledby="new-program-heading">
    <h2 id="new-program-heading" className="text-lg font-semibold text-brand-950">New program</h2>
    <p className="mt-1 text-sm text-slate-600">It starts as a draft. Nobody outside the team sees it until you publish it.</p>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <label htmlFor="new-program-title" className="text-sm font-semibold">Program name <span aria-hidden="true" className="text-red-700">*</span></label>
        <input id="new-program-title" required maxLength={LIMITS.title} value={title} onChange={e => setTitle(e.target.value)} className={fieldClass} aria-invalid={Boolean(titleProblem)} aria-describedby="new-program-title-hint" />
        <p id="new-program-title-hint" className={`mt-1 text-xs ${titleProblem ? 'text-red-800' : 'text-slate-500'}`}>{titleProblem ?? 'For example: Statistics for Research.'}</p>
      </div>
      <div>
        <label htmlFor="new-program-slug" className="text-sm font-semibold">Web address (the part after /programs/)</label>
        <input id="new-program-slug" value={address} maxLength={80} onChange={e => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} className={fieldClass} aria-invalid={Boolean(addressProblem)} aria-describedby="new-program-slug-hint" />
        <p id="new-program-slug-hint" className={`mt-1 text-xs ${addressProblem ? 'text-red-800' : 'text-slate-500'}`}>{addressProblem ?? 'Filled in from the name. You can change it until the first publish.'}</p>
      </div>
    </div>
    <div className="mt-3"><Feedback error={error} message="" /></div>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="submit" disabled={busy || title.trim().length < 3 || Boolean(addressProblem)} className={actionClass}>{busy ? 'Creating…' : 'Create draft program'}</button>
      <button type="button" onClick={onCancel} className={secondaryClass}>Cancel</button>
    </div>
  </form>;
}

export default function ProgramList() {
  const { state, reload } = useAccountResource('/admin/curriculum/programs', parseProgramList);
  const [search, setSearch] = useState(''), [show, setShow] = useState<'all' | PublishStatus>('all'), [creating, setCreating] = useState(false);
  return <AdminPage eyebrow="Operations / Programs & courses" title="Programs & courses" intro="Everything visitors see about a program and its courses: name, price, seats, timetable, description and the full curriculum. Drafts are private until you publish them.">
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor="program-search" className="text-sm font-semibold">Search programs</label>
        <input id="program-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, subject or level" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="program-show" className="text-sm font-semibold">Show</label>
        <select id="program-show" value={show} onChange={e => setShow(e.target.value as 'all' | PublishStatus)} className={`${fieldClass} min-h-11`}>
          <option value="all">All programs</option><option value="published">Published only</option><option value="draft">Drafts only</option>
        </select>
      </div>
      {!creating && <button type="button" onClick={() => setCreating(true)} className={actionClass}>New program</button>}
    </div>
    {creating && <NewProgram onCancel={() => setCreating(false)} />}
    <ResourceView state={state} reload={reload} label="programs">{programs => {
      const shown = filterPrograms(programs, search, show);
      if (!programs.length) return <div className={cardClass}><p className="text-sm text-slate-600">There are no programs yet. Create the first one; it stays a private draft until you publish it.</p>{!creating && <button type="button" onClick={() => setCreating(true)} className={`${actionClass} mt-4`}>New program</button>}</div>;
      return <>
        <p role="status" className="text-sm text-slate-600">{shown.length} of {programs.length} program{programs.length === 1 ? '' : 's'}</p>
        {shown.length ? <ul className="grid gap-4 md:grid-cols-2">{shown.map(p => <li key={p.id} className={`${cardClass} flex flex-col`}>
          <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 break-words text-lg font-semibold text-brand-950">{p.title}</h2><StatusBadge status={p.status} /></div>
          <p className="mt-1 break-all text-xs text-slate-500">/programs/{p.slug}</p>
          <p className="mt-2 line-clamp-2 text-sm text-slate-600">{p.summary || 'No summary yet.'}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">Courses</dt><dd className="font-semibold">{p.published_course_count}/{p.course_count} live</dd></div>
            <div><dt className="text-xs text-slate-500">Fee</dt><dd className="font-semibold">{formatTaka(p.fee)}</dd></div>
            <div><dt className="text-xs text-slate-500">Level</dt><dd className="break-words font-semibold">{p.level || '—'}</dd></div>
          </dl>
          <div className="mt-auto flex flex-wrap gap-3 pt-4">
            <Link to={`/admin/programs/${p.id}`} className={actionClass}>Edit {p.title}</Link>
            {p.status === 'published' && <a href={`/programs/${p.slug}`} target="_blank" rel="noreferrer" className={secondaryClass}>View on site<span className="sr-only"> (opens in a new tab)</span></a>}
          </div>
        </li>)}</ul> : <div className={cardClass}><p className="text-sm text-slate-600">No program matches your search.</p><button type="button" onClick={() => { setSearch(''); setShow('all'); }} className={`${secondaryClass} mt-3`}>Clear search</button></div>}
      </>;
    }}</ResourceView>
  </AdminPage>;
}
