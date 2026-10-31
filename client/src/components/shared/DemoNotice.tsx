import { DEMO_COMMERCIAL_CALLOUT, DEMO_DISCLAIMER } from './compliance';

export function DemoDisclosure() {
  return <aside aria-label="Local demonstration disclaimer" className="text-xs leading-6">{DEMO_DISCLAIMER}</aside>;
}

export function DemoCallout({ children = DEMO_COMMERCIAL_CALLOUT }: { children?: React.ReactNode }) {
  return <aside aria-label="Demo limitations" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{children}</aside>;
}
