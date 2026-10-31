// Recharts theme tokens — keep chart styling consistent with the design system.

export const CHART_COLORS = {
  brand: '#245448',
  brandLight: '#a7c2b2',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  slate: '#626f71',
  slateLight: '#c3c7c2',
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
    border: '1px solid #dedcd3',
    borderRadius: '12px',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    fontSize: '12px',
    padding: '8px 12px',
  },
  cursor: { fill: 'rgba(36, 84, 72, 0.06)' },
};

export const axisStyle = {
  tick: { fontSize: 11, fill: '#626f71' },
  axisLine: { stroke: '#dedcd3' },
  tickLine: { stroke: '#dedcd3' },
};

export const gridStyle = {
  strokeDasharray: '3 3',
  stroke: '#eeeee9',
};
