import { DEMO_COMMERCIAL_CALLOUT, DEMO_DISCLAIMER } from './compliance';

export function DemoBanner() {
  return <aside aria-label="Local demonstration disclaimer" className="border-b border-amber-200 bg-amber-100 px-4 py-2 text-center text-xs font-semibold leading-5 text-amber-950">{DEMO_DISCLAIMER}</aside>;
}

export function DemoCallout({ children = DEMO_COMMERCIAL_CALLOUT }: { children?: React.ReactNode }) {
  return <aside aria-label="Demo limitations" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{children}</aside>;
}
