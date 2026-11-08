import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useAccountResource } from '../../accounts/useAccountResource';
import { AdminPage, ResourceView } from '../AdminShared';
import { actionCards, formatBdt, parseHome, plural, type HomeData } from './operationsModel';
import { EmptyState, KeyNumber, Pill, cardClass, secondaryClass } from './OperationsUi';

/**
 * Overview for every staff role: what is waiting for someone right now, with a
 * direct link to the screen that resolves it. The server only returns the
 * queues this person's role may see (and cash only for finance roles).
 */
export default function AdminHome() {
  const { user } = useAuth();
  const { state, reload } = useAccountResource('/admin/operations/home', parseHome);
  return <AdminPage eyebrow="Overview" title={user ? `Hello, ${user.full_name.split(' ')[0]}` : 'Overview'}
    intro="What needs attention today. Each card counts real records and links straight to the screen where you can act.">
    <ResourceView state={state} reload={reload} label="today's work">{data => <HomeBody data={data} reload={reload} />}</ResourceView>
  </AdminPage>;
}

function HomeBody({ data, reload }: { data: HomeData; reload: () => void }) {
  const cards = actionCards(data);
  const waiting = cards.filter(card => card.count > 0);
  return <>
    <section aria-labelledby="todo-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="todo-heading" className="text-lg font-semibold text-brand-950">Waiting for action</h2>
        <button type="button" onClick={reload} className={secondaryClass}>Refresh</button>
      </div>
      {cards.length === 0
        ? <EmptyState title="No work queues for your role" body="Your role does not include any queues on this page. Use the menu to open the screens you work in." />
        : <>
          {waiting.length === 0 && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">All clear: nothing is waiting in your queues right now.</p>}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(card => <li key={card.key} className={`${cardClass} flex flex-col`}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-800">{card.title}</h3>
                {card.urgent && <Pill tone="bad">Needs attention</Pill>}
              </div>
              <p className="mt-2 text-3xl font-semibold text-brand-950" aria-label={`${card.count} ${card.title.toLowerCase()}`}>{card.count}</p>
              <p className="mt-1 flex-1 text-sm text-slate-600">{card.detail}</p>
              <Link to={card.href} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline-offset-4 hover:underline">{card.linkLabel} →</Link>
            </li>)}
          </ul>
        </>}
    </section>
    <section aria-labelledby="numbers-heading" className="space-y-3">
      <h2 id="numbers-heading" className="text-lg font-semibold text-brand-950">Key numbers</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <KeyNumber label="Active learners" value={String(data.numbers.active_learners)} note="Learners with at least one active enrollment" />
        <KeyNumber label="Open cohorts" value={String(data.numbers.open_cohorts)} note={`${plural(data.numbers.open_cohorts, 'cohort')} currently open`} />
        {data.numbers.cash_collected !== null && <KeyNumber label="Cash collected" value={formatBdt(data.numbers.cash_collected)} note="Successful payments recorded in this demo (no live payment provider)" />}
      </div>
    </section>
  </>;
}
