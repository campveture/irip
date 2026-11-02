// Explanatory mathematics, not IRIP outcome data.
export function falseAlarmProbability(tests: number, alpha = 0.05): number {
  if (!Number.isSafeInteger(tests) || tests < 1 || tests > 10000 || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new Error('Invalid independent-testing scenario.');
  return 1 - (1 - alpha) ** tests;
}
export const simpsonGroups = [
  { label: 'Easy tasks', a: { successes: 81, total: 90 }, b: { successes: 19, total: 20 } },
  { label: 'Hard tasks', a: { successes: 1, total: 10 }, b: { successes: 16, total: 80 } },
] as const;
export function combinedRates() {
  return { a: simpsonGroups.reduce((sum,row) => sum + row.a.successes,0) / simpsonGroups.reduce((sum,row) => sum + row.a.total,0),
    b: simpsonGroups.reduce((sum,row) => sum + row.b.successes,0) / simpsonGroups.reduce((sum,row) => sum + row.b.total,0) };
}
