// Recharts theme tokens — keep chart styling consistent with the design system.

export const CHART_COLORS = {
  brand: '#2563eb',
  brandLight: '#60a5fa',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  slate: '#94a3b8',
  slateLight: '#cbd5e1',
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
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    fontSize: '12px',
    padding: '8px 12px',
  },
  cursor: { fill: 'rgba(37, 99, 235, 0.06)' },
};

export const axisStyle = {
  tick: { fontSize: 11, fill: '#64748b' },
  axisLine: { stroke: '#e2e8f0' },
  tickLine: { stroke: '#e2e8f0' },
};

export const gridStyle = {
  strokeDasharray: '3 3',
  stroke: '#f1f5f9',
};