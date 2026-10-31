export const INSTALLMENT_SUMMARY = 'Three installments: first at enrollment, second when classes start, and third one calendar month after classes start.';

export const INSTALLMENT_MILESTONES = [
  'At enrollment',
  'When classes start',
  'One calendar month after classes start',
] as const;

export interface InstallmentPlan {
  readonly total: number;
  readonly currency: string;
  readonly amounts: readonly [number, number, number];
  readonly hasRoundingAdjustment: boolean;
}

// Round the first two payments down to thousands; the final covers the balance.
export function createInstallmentPlan(total: unknown, currency: unknown = 'BDT'): InstallmentPlan | null {
  if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0
    || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;
  const first = Math.floor(total / 3000) * 1000;
  return {
    total, currency,
    amounts: [first, first, total - first * 2],
    hasRoundingAdjustment: total !== first * 3,
  };
}

export function formatInstallmentAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}
