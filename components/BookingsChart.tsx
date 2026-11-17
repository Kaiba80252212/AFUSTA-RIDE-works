'use client';

import { useState } from 'react';
import { useTheme } from './ThemeProvider';

interface DataPoint {
  day: string;
  value: number;
}

const SERIES_BY_RANGE: Record<'This Month' | 'This Week' | 'Today', DataPoint[]> = {
  'This Month': [
    { day: 'Mon', value: 7200 },
    { day: 'Tue', value: 17400 },
    { day: 'Wed', value: 21200 },
    { day: 'Thu', value: 18600 },
    { day: 'Fri', value: 25400 },
    { day: 'Sat', value: 31800 },
    { day: 'Sun', value: 40000 },
  ],
  'This Week': [
    { day: 'Mon', value: 1800 },
    { day: 'Tue', value: 4200 },
    { day: 'Wed', value: 5100 },
    { day: 'Thu', value: 4700 },
    { day: 'Fri', value: 6400 },
    { day: 'Sat', value: 7900 },
    { day: 'Sun', value: 9400 },
  ],
  Today: [
    { day: '8 AM', value: 310 },
    { day: '10 AM', value: 640 },
    { day: '12 PM', value: 890 },
    { day: '2 PM', value: 760 },
    { day: '4 PM', value: 1120 },
    { day: '6 PM', value: 980 },
    { day: '8 PM', value: 1290 },
  ],
};

export function BookingsChart({
  range = 'This Month',
}: {
  range?: 'This Month' | 'This Week' | 'Today';
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const data = SERIES_BY_RANGE[range];
  const maxVal = range === 'This Month' ? 40000 : range === 'This Week' ? 10000 : 1500;
  const yTicks =
    range === 'This Month'
      ? [0, 10000, 20000, 30000, 40000]
      : range === 'This Week'
      ? [0, 2500, 5000, 7500, 10000]
      : [0, 400, 800, 1200, 1500];

  const width = 560;
  const height = 220;
  const padLeft = 46;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const coords = data.map((d, i) => {
    const x = padLeft + (i / (data.length - 1)) * plotW;
    const y = padTop + plotH - (d.value / maxVal) * plotH;
    return { ...d, x, y };
  });

  const polylinePoints = coords.map((p) => `${p.x},${p.y}`).join(' ');

  const gridColor = isDark ? '#2B3848' : '#E2E8F0';
  const tickColor = isDark ? '#94A3B8' : '#64748B';
  const xAxisColor = isDark ? '#CBD5E1' : '#475569';
  const lineColor = isDark ? '#4EA4F6' : '#2481CC';
  const pointStroke = isDark ? '#17212B' : '#FFFFFF';
  const tooltipBg = isDark ? '#232E3C' : '#0F172A';

  return (
    <div className="w-full">
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-56 select-none"
          role="img"
          aria-label={`Bookings overview line chart for ${range}`}
        >
          {/* Horizontal gridlines */}
          {yTicks.map((tick) => {
            const y = padTop + plotH - (tick / maxVal) * plotH;
            const label =
              tick >= 1000 ? `${(tick / 1000).toFixed(tick % 1000 === 0 ? 0 : 1)}k` : `${tick}`;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={gridColor}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill={tickColor}
                  className="tabular-nums"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Crisp polyline without any gradient fill */}
          <polyline
            fill="none"
            stroke={lineColor}
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />

          {/* Data point circles & x-axis labels */}
          {coords.map((pt, idx) => {
            const isActive = hoveredIdx === idx;
            return (
              <g key={pt.day}>
                <text
                  x={pt.x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill={xAxisColor}
                  fontWeight={isActive ? '700' : '500'}
                >
                  {pt.day}
                </text>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isActive ? 6 : 4.5}
                  fill={lineColor}
                  stroke={pointStroke}
                  strokeWidth="2"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
                {isActive && (
                  <g
                    transform={`translate(${Math.min(Math.max(pt.x, 70), width - 70)}, ${Math.max(
                      pt.y - 26,
                      16
                    )})`}
                  >
                    <rect x="-42" y="-14" width="84" height="22" rx="6" fill={tooltipBg} />
                    <text
                      x="0"
                      y="1"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill="#FFFFFF"
                      className="tabular-nums"
                    >
                      {pt.value.toLocaleString('en-NG')} rides
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
