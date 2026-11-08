import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPage, ResourceView, cardClass } from '../admin/AdminShared';
import { actionClass, fieldClass, secondaryClass } from '../accounts/accountModel';
import { useAccountResource } from '../accounts/useAccountResource';
import { Badge, EmptyNote, Tabs } from './MentorShared';
import { cancelledLabel, dhakaDateTime, dhakaTimeOnly, parseClassList, splitClasses, type ClassSummary } from './mentorModel';

const PAGE = 20;
type Tab = 'upcoming' | 'past';

export default function MentorClassList() {
  const { state, reload } = useAccountResource('/mentor/classes', parseClassList);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [cohort, setCohort] = useState('all');
  const [shown, setShown] = useState(PAGE);
  return <AdminPage eyebrow="Mentor workspace" title="My classes" intro="Classes for the cohorts you teach. Open a class to take attendance, add a short note and share a recording link. Times are Bangladesh time.">
    <ResourceView state={state} reload={reload} label="your classes">{list => {
      const cohorts = [...new Map(list.map(c => [String(c.cohort_id), `${c.program_title} · ${c.cohort_name}`])).entries()];
      const filtered = cohort === 'all' ? list : list.filter(c => String(c.cohort_id) === cohort);
      const { upcoming, past } = splitClasses(filtered);
      const rows = tab === 'upcoming' ? upcoming : past;
      return <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Tabs label="Class timing" active={tab} onChange={key => { setTab(key); setShown(PAGE); }} tabs={[{ key: 'upcoming', label: 'Upcoming', count: upcoming.length }, { key: 'past', label: 'Past', count: past.length }]} />
          {cohorts.length > 1 && <div className="sm:w-72">
            <label htmlFor="class-cohort" className="text-sm font-semibold">Cohort</label>
            <select id="class-cohort" value={cohort} onChange={e => { setCohort(e.target.value); setShown(PAGE); }} className={fieldClass}>
              <option value="all">All my cohorts</option>
              {cohorts.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>}
        </div>
        <div role="tabpanel" aria-label={tab === 'upcoming' ? 'Upcoming classes' : 'Past classes'}>
          {rows.length === 0
            ? <EmptyNote title={list.length === 0 ? 'No classes yet.' : tab === 'upcoming' ? 'No upcoming classes.' : 'No past classes yet.'}>
                <p>{list.length === 0 ? 'Classes appear here once the academic team assigns you to a cohort and schedules its sessions.' : tab === 'upcoming' ? 'Check past classes to finish attendance and notes.' : 'Classes move here when they end.'}</p>
                {list.length > 0 && <button type="button" className={secondaryClass} onClick={() => setTab(tab === 'upcoming' ? 'past' : 'upcoming')}>Show {tab === 'upcoming' ? 'past' : 'upcoming'} classes</button>}
              </EmptyNote>
            : <ul className="space-y-3">{rows.slice(0, shown).map(c => <ClassRow key={c.id} item={c} past={tab === 'past'} />)}</ul>}
          {rows.length > shown && <button type="button" className={`${secondaryClass} mt-4`} onClick={() => setShown(n => n + PAGE)}>Show more classes</button>}
        </div>
      </div>;
    }}</ResourceView>
  </AdminPage>;
}

function ClassRow({ item: c, past }: { item: ClassSummary; past: boolean }) {
  const complete = c.enrolled > 0 && c.attendance_recorded >= c.enrolled;
  const needsAttendance = past && !c.cancelled && !complete && c.enrolled > 0;
  return <li className={`${cardClass} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
    <div className="min-w-0">
      <p className="font-semibold text-slate-900">{c.title}</p>
      <p className="text-sm text-slate-600"><time dateTime={c.starts_at}>{dhakaDateTime(c.starts_at)}</time>–{dhakaTimeOnly(c.ends_at)}</p>
      <p className="text-sm text-slate-600">{c.program_title} · {c.cohort_name}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge>{c.kind.replace(/_/g, ' ')}</Badge>
        {c.cancelled && <Badge kind="warn">{cancelledLabel(c)}</Badge>}
        {past && !c.cancelled && (c.enrolled === 0 ? <Badge>No enrolled learners</Badge> : complete ? <Badge kind="good">Attendance taken</Badge> : <Badge kind="warn">Attendance: {c.attendance_recorded} of {c.enrolled} marked</Badge>)}
      </div>
    </div>
    <div className="flex shrink-0 flex-wrap gap-2">
      {!past && !c.cancelled && c.meeting_link && <a href={c.meeting_link} target="_blank" rel="noopener noreferrer" className={actionClass}>Join class<span className="sr-only"> {c.title} (opens in a new tab)</span></a>}
      <Link to={`/mentor/classes/${c.id}`} className={needsAttendance ? actionClass : secondaryClass}>{needsAttendance ? 'Take attendance' : 'Open class'}<span className="sr-only">: {c.title}</span></Link>
    </div>
  </li>;
}
