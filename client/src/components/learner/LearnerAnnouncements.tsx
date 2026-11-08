import { useState } from 'react';
import { secondaryClass } from '../accounts/accountModel';
import { useAccountResource } from '../accounts/useAccountResource';
import { EditSpot } from '../admin/preview/PreviewKit';
import { EmptyNote, StatusPill, cardClass } from './LearnerShared';
import { dhakaDateTime } from './learnerModel';
import { groupByCohort, parseAnnouncements, type Announcement } from './announcements';

/**
 * One announcement exactly as learners see it. Also rendered by the staff/mentor editor
 * preview (components/admin/accounts/AnnouncementsManager.tsx) with the unsaved draft;
 * the EditSpots show Edit buttons only there.
 */
export function AnnouncementCard({ item }: { item: Announcement }) {
  return <article className={`rounded-xl border p-4 ${item.pinned ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white'}`}>
    <div className="flex flex-wrap items-center gap-2">
      {item.pinned && <StatusPill tone="info">Pinned</StatusPill>}
      <span className="text-xs text-slate-600">{item.cohort_name}{item.program_title ? ` · ${item.program_title}` : ''}</span>
    </div>
    <EditSpot target="announcement-title" label="title"><h3 className="mt-2 break-words font-semibold text-brand-950">{item.title}</h3></EditSpot>
    <EditSpot target="announcement-body" label="message"><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{item.body}</p></EditSpot>
    <p className="mt-2 text-xs text-slate-600">{item.author_name} · <time dateTime={item.published_at}>{dhakaDateTime(item.published_at)}</time>{item.updated_at ? ' · edited' : ''}</p>
  </article>;
}

/** Pure list view (home page + full list share it). */
export function AnnouncementList({ items, grouped = false }: { items: Announcement[]; grouped?: boolean }) {
  if (!grouped) return <ul className="space-y-3">{items.map(item => <li key={item.id}><AnnouncementCard item={item} /></li>)}</ul>;
  return <div className="space-y-5">{groupByCohort(items).map(group => <section key={group.cohort} aria-label={`Announcements for ${group.cohort}`}>
    <h3 className="text-sm font-semibold text-slate-700">{group.cohort}</h3>
    <ul className="mt-2 space-y-3">{group.items.map(item => <li key={item.id}><AnnouncementCard item={item} /></li>)}</ul>
  </section>)}</div>;
}

/** Learner home section: latest three (pinned first), with "Show all" for the full cohort list. */
export default function LearnerAnnouncements() {
  const { state, reload } = useAccountResource('/student/announcements', parseAnnouncements);
  const [all, setAll] = useState(false);
  return <section aria-labelledby="announcements-heading" className={`${cardClass} lg:col-span-2`}>
    <h2 id="announcements-heading" className="text-lg font-semibold text-brand-950">Announcements</h2>
    <div className="mt-3">
      {state.status === 'loading' && <p role="status" className="text-sm text-slate-600">Loading announcements…</p>}
      {state.status === 'error' && <div className="rounded-xl bg-red-50 p-4"><p role="alert" className="text-sm text-red-900">{state.message}</p><button type="button" onClick={reload} className={`${secondaryClass} mt-3`}>Retry</button></div>}
      {state.status === 'ready' && (state.data.length === 0
        ? <EmptyNote>No announcements yet. Messages from your mentors and the IRIP team about your cohort will appear here.</EmptyNote>
        : <>
          <AnnouncementList items={all ? state.data : state.data.slice(0, 3)} grouped={all} />
          {state.data.length > 3 && <button type="button" aria-expanded={all} onClick={() => setAll(v => !v)} className={`${secondaryClass} mt-4`}>{all ? 'Show fewer' : `Show all ${state.data.length} announcements`}</button>}
        </>)}
    </div>
  </section>;
}
