import { DEMO_COMMERCIAL_CALLOUT, DEMO_DISCLAIMER } from './compliance';

export function DemoDisclosure() {
  return <aside aria-label="Local demonstration disclaimer" className="text-[13px] leading-6">{DEMO_DISCLAIMER}</aside>;
}

export function DemoCallout({ children = DEMO_COMMERCIAL_CALLOUT }: { children?: React.ReactNode }) {
  return <aside aria-label="Demo limitations" className="rounded-xl border border-warning-500/30 bg-warning-50 p-4 text-sm leading-6 text-warning-600">{children}</aside>;
}
