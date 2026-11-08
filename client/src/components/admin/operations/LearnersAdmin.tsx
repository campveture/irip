import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useAccountResource } from '../../accounts/useAccountResource';
import { AdminPage, ResourceView } from '../AdminShared';
import LearnerAccountControl from '../LearnerAccountControl';
import TemporaryPassword from '../accounts/TemporaryPassword';
import { LearnerExtensions } from '../accounts/ExtensionTools';
import LearnerEnrollments from '../enrollments/LearnerEnrollments';
import { dhakaDate, parseLearnerDetail, parseLearners, plural, type LearnerDetail } from './operationsModel';
import { EmptyState, Pill, SearchBox, cardClass, secondaryClass, useDebounced, type Tone } from './OperationsUi';

const statusTone = (status: string): Tone => (status === 'active' ? 'good' : status === 'suspended' ? 'bad' : 'neutral');
const STATE_TONE: Record<string, Tone> = { active: 'good', completed: 'good', graded: 'good', pending: 'warn', paused: 'warn', withdrawn: 'neutral', submitted: 'warn', changes_requested: 'warn', open: 'warn', cancelled: 'neutral', closed: 'neutral', resolved: 'good' };
const label = (value: string) => value.replace(/_/g, ' ');

/** Learner directory: search by name or email, open the learner's record. */
export function LearnersList() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search).trim();
  const { state, reload } = useAccountResource(`/admin/learners${debounced ? `?search=${encodeURIComponent(debounced)}` : ''}`, parseLearners);
  return <AdminPage eyebrow="Learners" title="Learners" intro="Everyone with a learner account. Open a learner to see their enrollments, recent work, support requests and account status.">
    <form role="search" onSubmit={e => e.preventDefault()} className={cardClass}>
      <SearchBox id="learner-search" label="Search learners" value={search} onChange={setSearch} placeholder="Name or email" />
    </form>
    <ResourceView state={state} reload={reload} label="learners">{rows => <>
      <p role="status" className="text-sm text-slate-600">{debounced ? `${plural(rows.length, 'learner')} match “${debounced}”.` : `${plural(rows.length, 'learner')} in total.`}</p>
      {rows.length === 0
        ? <EmptyState title={debounced ? 'No learner matches' : 'No learners yet'} body={debounced ? 'Check the spelling or search by email address.' : 'Learners appear here after they create an account on the website.'}
            action={debounced ? { label: 'Clear search', onClick: () => setSearch('') } : undefined} />
        : <ul className="grid gap-3 md:grid-cols-2">{rows.map(l => <li key={l.id}>
          <Link to={`/admin/learners/${l.id}`} className="block h-full rounded-2xl border border-brand-100 bg-white p-4 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">
            <span className="flex flex-wrap items-center gap-2">
              <Pill tone={statusTone(l.status)}>{label(l.status)}</Pill>
              {!l.email_verified && <Pill tone="warn">Email not verified</Pill>}
            </span>
            <span className="mt-2 block break-words font-semibold text-brand-950">{l.full_name}</span>
            <span className="block break-all text-sm text-slate-600">{l.email}</span>
            <span className="mt-1 block text-xs text-slate-500">{plural(l.active_enrollments, 'active enrollment')}{l.phone ? ` · ${l.phone}` : ''}</span>
          </Link>
        </li>)}</ul>}
    </>}</ResourceView>
  </AdminPage>;
}

/** Learner 360: one learner's record, with account status control at the bottom. */
export function LearnerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const { state, reload } = useAccountResource(`/admin/learners/${encodeURIComponent(id)}`, parseLearnerDetail);
  const canSeeAcademic = roles.some(r => ['academic_ops', 'admin', 'owner'].includes(r));
  const canOpenTickets = roles.some(r => ['support', 'admin', 'owner'].includes(r));
  return <AdminPage eyebrow="Learner record" title="Learner 360" intro="Enrollments, recent submissions and support requests for one learner.">
    <button type="button" onClick={() => navigate('/admin/learners')} className={secondaryClass}>← All learners</button>
    <ResourceView state={state} reload={reload} label="learner record">{data => <Detail data={data} canSeeAcademic={canSeeAcademic} canOpenTickets={canOpenTickets} />}</ResourceView>
    {/* Enrolment controls (enrollments.manage holds the same roles as learners.read_academic). */}
    {id && canSeeAcademic && <LearnerEnrollments learnerId={id} onChanged={reload} />}
    {id && <LearnerAccountControl learnerId={id} />}
    {state.status === 'ready' && <><LearnerExtensions learnerId={state.data.user.id} /><TemporaryPassword userId={state.data.user.id} name={state.data.user.full_name} /></>}
  </AdminPage>;
}

function Detail({ data, canSeeAcademic, canOpenTickets }: { data: LearnerDetail; canSeeAcademic: boolean; canOpenTickets: boolean }) {
  const { user, profile, enrollments, submissions, tickets } = data;
  const active = enrollments.filter(e => e.state === 'active').length;
  return <>
    <section aria-labelledby="learner-name" className={cardClass}>
      <h2 id="learner-name" className="break-words text-xl font-semibold text-brand-950">{user.full_name}</h2>
      <p className="break-all text-sm text-slate-600">{user.email}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact term="Account" value={<Pill tone={statusTone(user.status)}>{label(user.status)}</Pill>} />
        <Fact term="Email verified" value={user.email_verified ? 'Yes' : 'No'} />
        <Fact term="Active enrollments" value={String(active)} />
        <Fact term="Phone" value={profile.phone ?? 'Not given'} />
        <Fact term="Joined" value={dhakaDate(user.created_at)} />
      </dl>
      {canSeeAcademic && (profile.goals || profile.interests || profile.study_plan) && <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
        {profile.goals && <TextBlock title="Goals" body={profile.goals} />}
        {profile.interests && <TextBlock title="Areas of interest" body={profile.interests} />}
        {profile.study_plan && <TextBlock title="Study plan" body={profile.study_plan} />}
      </div>}
    </section>
    <section aria-labelledby="enrollments-heading" className={cardClass}>
      <h2 id="enrollments-heading" className="font-semibold text-brand-950">Enrollments ({enrollments.length})</h2>
      {enrollments.length === 0 ? <p className="mt-2 text-sm text-slate-600">Not enrolled in any cohort.</p>
        : <ul className="mt-3 space-y-2">{enrollments.map(e => <li key={e.id} className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">{e.program_title} <Pill tone={STATE_TONE[e.state] ?? 'neutral'}>{label(e.state)}</Pill></p>
          <p className="text-slate-600">{e.cohort_name}{e.start_date ? ` · ${dhakaDate(e.start_date)}` : ''}{e.end_date ? ` – ${dhakaDate(e.end_date)}` : ''}</p>
        </li>)}</ul>}
    </section>
    <section aria-labelledby="submissions-heading" className={cardClass}>
      <h2 id="submissions-heading" className="font-semibold text-brand-950">Recent submissions</h2>
      {!canSeeAcademic ? <p className="mt-2 text-sm text-slate-600">Grades and submissions are visible to academic staff only.</p>
        : submissions.length === 0 ? <p className="mt-2 text-sm text-slate-600">No submissions yet.</p>
        : <ul className="mt-3 space-y-2">{submissions.map(s => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
          <span className="min-w-0 break-words font-semibold text-slate-900">{s.assessment_title}</span>
          <span className="flex items-center gap-2"><Pill tone={STATE_TONE[s.state] ?? 'neutral'}>{label(s.state)}</Pill>{s.score !== null && <span className="text-slate-700">Score {s.score}/100</span>}</span>
        </li>)}</ul>}
    </section>
    <section aria-labelledby="tickets-heading" className={cardClass}>
      <h2 id="tickets-heading" className="font-semibold text-brand-950">Recent support requests</h2>
      {tickets.length === 0 ? <p className="mt-2 text-sm text-slate-600">No support requests.</p>
        : <ul className="mt-3 space-y-2">{tickets.map(t => <li key={t.id} className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2"><Pill tone={STATE_TONE[t.state] ?? 'neutral'}>{label(t.state)}</Pill><span className="text-xs text-slate-600">{t.ticket_no} · {dhakaDate(t.created_at)}</span></p>
          {canOpenTickets ? <Link to={`/admin/support?ticket=${t.id}`} className="mt-1 block break-words font-semibold text-brand-800 underline">{t.subject}</Link>
            : <p className="mt-1 break-words font-semibold text-slate-900">{t.subject}</p>}
        </li>)}</ul>}
    </section>
  </>;
}

function Fact({ term, value }: { term: string; value: ReactNode }) {
  return <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{term}</dt><dd className="mt-1 break-words font-semibold text-slate-900">{value}</dd></div>;
}
function TextBlock({ title, body }: { title: string; body: string }) {
  return <div><p className="text-xs font-semibold text-slate-500">{title}</p><p className="mt-1 whitespace-pre-wrap break-words text-slate-800">{body}</p></div>;
}
