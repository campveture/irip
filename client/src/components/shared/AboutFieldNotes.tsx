/** Original schematic, not an academy result or a photograph of real learners. */
export function AboutFieldNotes() {
  return <figure className="min-w-0 rounded-[1.75rem] border border-white/15 bg-canvas p-5 text-slate-900 shadow-xl sm:p-7">
    <div className="flex items-center justify-between gap-3 border-b border-stone pb-4">
      <p className="font-mono text-[10px] uppercase tracking-[.16em] text-brand-700">The field notebook / 001</p>
      <span className="rounded-full border border-stone px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">Work in progress</span>
    </div>
    <svg viewBox="0 0 360 320" role="img" aria-label="A research notebook: begin with a question, choose a method, examine the evidence, then revise and ask again." className="my-5 w-full">
      <defs><pattern id="about-notebook-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="var(--palette-stone)" strokeWidth=".6" /></pattern></defs>
      <rect width="360" height="320" rx="16" fill="url(#about-notebook-grid)" />
      <path d="M86 80H273V145M273 187V255H86V188" fill="none" stroke="var(--palette-evergreen)" strokeWidth="2" strokeDasharray="5 5" />
      <path d="m268 135 5 10 5-10M91 198l-5-10-5 10" fill="none" stroke="var(--palette-evergreen)" strokeWidth="2" />
      <g fontFamily="system-ui, sans-serif">
        <rect x="27" y="44" width="144" height="62" rx="12" fill="var(--palette-midnight)" />
        <text x="44" y="65" fill="var(--palette-brass)" fontSize="10" letterSpacing="1.5">01 / BEGIN</text>
        <text x="44" y="88" fill="white" fontSize="16" fontWeight="600">The question</text>
        <rect x="193" y="144" width="144" height="62" rx="12" fill="var(--palette-evergreen)" />
        <text x="210" y="165" fill="var(--palette-paper)" fontSize="10" letterSpacing="1.5">02 / INVESTIGATE</text>
        <text x="210" y="188" fill="white" fontSize="16" fontWeight="600">The method</text>
        <rect x="27" y="226" width="144" height="62" rx="12" fill="var(--palette-brass)" />
        <text x="44" y="247" fill="var(--palette-midnight)" fontSize="10" letterSpacing="1.5">03 / REFLECT</text>
        <text x="44" y="270" fill="var(--palette-midnight)" fontSize="16" fontWeight="600">The evidence</text>
        <text x="33" y="174" fill="var(--palette-evergreen)" fontSize="14" fontStyle="italic">revise. ask again.</text>
      </g>
    </svg>
    <figcaption className="border-t border-stone pt-4 text-xs leading-6 text-slate-600">Our proposed approach, sketched out. Research is a process of revision, not a straight line to the answer you wanted.</figcaption>
  </figure>;
}
