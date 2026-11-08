import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPage, ResourceView, cardClass } from '../admin/AdminShared';
import { actionClass, fieldClass, secondaryClass } from '../accounts/accountModel';
import { useAccountResource } from '../accounts/useAccountResource';
import { Badge, EmptyNote, Tabs } from './MentorShared';
import { QUEUE_TABS, dhakaDateTime, parseQueue, queueTab, waitingFor, type QueueItem, type QueueState } from './mentorModel';

const PAGE = 20;
const EMPTY: Record<QueueState, string> = {
  submitted: 'Nothing is waiting for review. New submissions from your cohorts appear here, oldest first.',
  changes_requested: 'No work is out for changes. When you ask a learner to revise, it waits here until they resubmit.',
  graded: 'Nothing graded yet. Final grades you record appear here.',
};

export default function MentorGradingQueue() {
  const { state, reload } = useAccountResource('/mentor/grading', parseQueue);
  const [tab, setTab] = useState<QueueState>('submitted');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE);
  return <AdminPage eyebrow="Mentor workspace" title="Grading" intro="Submissions from the cohorts you teach. Review the oldest first. Each attempt can be reviewed once: record a final grade, or request changes while attempts remain.">
    <ResourceView state={state} reload={reload} label="your grading queue">{items => {
      const term = search.trim().toLowerCase();
      const matches = (i: QueueItem) => !term || [i.learner_name, i.assessment_title, i.cohort_name, i.course_title ?? ''].some(v => v.toLowerCase().includes(term));
      const tabs = QUEUE_TABS.map(t => ({ ...t, count: queueTab(items, t.key).length }));
      const rows = queueTab(items, tab).filter(matches);
      return <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <Tabs label="Submission status" tabs={tabs} active={tab} onChange={key => { setTab(key); setShown(PAGE); }} />
          <div className="lg:w-80">
            <label htmlFor="grading-search" className="text-sm font-semibold">Search learner, assignment or cohort</label>
            <input id="grading-search" type="search" value={search} onChange={e => { setSearch(e.target.value); setShown(PAGE); }} className={fieldClass} />
          </div>
        </div>
        <div role="tabpanel" aria-label={QUEUE_TABS.find(t => t.key === tab)?.label}>
          {rows.length === 0
            ? <EmptyNote title={term ? 'No submissions match your search.' : 'Nothing here.'}>
                <p>{term ? 'Try a different name or clear the search.' : EMPTY[tab]}</p>
                {term && <button type="button" className={secondaryClass} onClick={() => setSearch('')}>Clear search</button>}
              </EmptyNote>
            : <ul className="space-y-3">{rows.slice(0, shown).map(item => <Row key={item.id} item={item} />)}</ul>}
          {rows.length > shown && <button type="button" className={`${secondaryClass} mt-4`} onClick={() => setShown(n => n + PAGE)}>Show more submissions</button>}
        </div>
      </div>;
    }}</ResourceView>
  </AdminPage>;
}

function Row({ item }: { item: QueueItem }) {
  const waiting = item.state === 'submitted';
  return <li className={`${cardClass} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
    <div className="min-w-0">
      <p className="font-semibold text-slate-900">{item.assessment_title}</p>
      <p className="text-sm text-slate-600">{item.learner_name} · Attempt {item.attempt} of {item.max_attempts || 1}</p>
      <p className="text-sm text-slate-600">{item.course_title ? `${item.course_title} · ` : ''}{item.cohort_name}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {waiting ? <Badge kind="warn">Waiting {waitingFor(item.submitted_at)}</Badge> : <Badge>Submitted {dhakaDateTime(item.submitted_at)}</Badge>}
        {item.state === 'graded' && item.score !== null && <Badge kind="good">Score {item.score}/100</Badge>}
        {item.state === 'changes_requested' && <Badge kind="brand">Waiting for the learner to resubmit</Badge>}
      </div>
    </div>
    <Link to={`/mentor/grading/${item.id}`} className={`${waiting ? actionClass : secondaryClass} shrink-0`}>{waiting ? 'Review' : 'View'}<span className="sr-only"> {item.assessment_title} by {item.learner_name}</span></Link>
  </li>;
}
