/** User-selected institution crest. Decorative beside IRIP's visible wordmark. */
export function IripMark({ className = '' }: { className?: string }) {
  return <img src="/images/irip-mark.svg?v=crest-1" width="80" height="80" alt="" aria-hidden="true" className={className} />;
}
