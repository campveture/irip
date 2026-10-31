import { useState } from 'react';
import { Surface } from '../shared/Surface';
import { estimateCreatorShare, inputClass } from './courseModel';

export function RevenueModel() {
  const [net, setNet] = useState('100000'); const [pool, setPool] = useState('50');
  const [own, setOwn] = useState('100'); const [total, setTotal] = useState('1000');
  const inputs = [net, pool, own, total];
  const estimate = inputs.some(value => value.trim() === '') ? null : estimateCreatorShare(Number(net), Number(pool), Number(own), Number(total));
  return <Surface className="p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Proposed creator economics</p><h2 className="mt-2 text-2xl font-semibold text-brand-950">Reward learning, not empty clicks.</h2><p className="mt-3 text-sm leading-7 text-slate-600">A proposed creator pool would distribute an approved share of net subscription revenue by verified eligible watch time. Raw page views, repeated loops, self-views and suspicious activity must not automatically generate earnings. Thresholds, caps, refunds, fraud checks and disputes still need policy approval.</p><div className="mt-5 rounded-xl bg-brand-50 p-4 text-sm leading-6 text-brand-950">Illustrative share = net revenue × creator-pool percentage × (your eligible minutes ÷ all eligible minutes).</div><h3 className="mt-6 font-semibold text-brand-950">Try a hypothetical period</h3><p className="mt-2 text-xs leading-5 text-slate-500">Every value below is a made-up assumption, including the 50% pool. This is not an approved rate, earnings forecast or payout balance.</p><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
    { title: 'Assumed net revenue (BDT)', value: net, set: setNet, max: 1000000000 },
    { title: 'Assumed creator pool (%)', value: pool, set: setPool, max: 100 },
    { title: 'Your eligible watch minutes', value: own, set: setOwn, max: 1000000000 },
    { title: 'All eligible watch minutes', value: total, set: setTotal, max: 1000000000 },
  ].map(input => <label key={input.title} className="text-sm font-medium">{input.title}<input type="number" min={0} max={input.max} step="any" className={inputClass} value={input.value} onChange={event => input.set(event.target.value)} /></label>)}</div><p role="status" className="mt-5 rounded-xl bg-brand-950 p-4 text-white">{estimate === null ? 'Enter non-negative values; your minutes cannot exceed all eligible minutes and the pool cannot exceed 100%.' : `Illustrative allocation: BDT ${estimate.toLocaleString('en-US', { maximumFractionDigits: 2 })} · Not payable`}</p>{total !== '' && Number(total) === 0 && <p className="mt-3 text-xs text-slate-500">No eligible minutes means no watch-time allocation in this illustration.</p>}</Surface>;
}
