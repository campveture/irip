// Recharts theme tokens — keep chart styling consistent with the design system.

export const CHART_COLORS = {
  brand: 'rgb(var(--irip-indigo))',
  brandLight: 'rgb(var(--irip-lavender))',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  slate: 'var(--color-text-muted)',
  slateLight: 'var(--color-control-border)',
};

export const CHART_PALETTE = [
  CHART_COLORS.brand,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
  CHART_COLORS.slate,
  CHART_COLORS.brandLight,
];

export const tooltipStyle = {
  contentStyle: {
    background: 'rgba(255,255,255,0.96)',
    border: '1px solid var(--color-border)',
    borderRadius: '12px',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    fontSize: '12px',
    padding: '8px 12px',
  },
  cursor: { fill: 'rgb(var(--irip-indigo) / 0.06)' },
};

export const axisStyle = {
  tick: { fontSize: 11, fill: 'var(--color-text-muted)' },
  axisLine: { stroke: 'var(--color-border)' },
  tickLine: { stroke: 'var(--color-border)' },
};

export const gridStyle = {
  strokeDasharray: '3 3',
  stroke: 'var(--color-border)',
};
