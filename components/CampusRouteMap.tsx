'use client';

import { Navigation, MapPin } from 'lucide-react';
import { CAMPUS_STOPS, getCampusStop } from '@/lib/campus-transit';
import { useTheme } from './ThemeProvider';

interface CampusRouteMapProps {
  fromStopId?: string;
  toStopId?: string;
  statusLabel?: string;
  heightClass?: string;
}

const ROAD_SEGMENTS: [string, string][] = [
  ['main-gate', 'senate'],
  ['main-gate', 'sub'],
  ['senate', 'medical-center'],
  ['senate', 'library'],
  ['senate', 'sub'],
  ['medical-center', 'faculty-science'],
  ['faculty-science', 'library'],
  ['faculty-science', 'faculty-eng'],
  ['library', 'convocation'],
  ['library', 'faculty-eng'],
  ['convocation', 'boys-hostel'],
  ['convocation', 'girls-hostel'],
  ['sub', 'convocation'],
  ['faculty-eng', 'boys-hostel'],
  ['boys-hostel', 'girls-hostel'],
];

const sx = (x: number) => 10 + (x / 100) * 180;
const sy = (y: number) => 14 + (y / 100) * 86;

export function CampusRouteMap({
  fromStopId = 'main-gate',
  toStopId = 'library',
  statusLabel = 'On Trip',
  heightClass = 'h-64',
}: CampusRouteMapProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const from = getCampusStop(fromStopId) ?? CAMPUS_STOPS[0];
  const to = getCampusStop(toStopId) ?? CAMPUS_STOPS[2];

  const fx = sx(from.x);
  const fy = sy(from.y);
  const tx = sx(to.x);
  const ty = sy(to.y);

  const trikeX = fx + (tx - fx) * 0.54;
  const trikeY = fy + (ty - fy) * 0.54;

  const mapBg = isDark ? '#121B24' : '#EFF3F0';
  const blockBg = isDark ? '#1B2734' : '#E3EAE4';
  const roadStroke = isDark ? '#2B3A4B' : '#FFFFFF';
  const routeStroke = isDark ? '#4EA4F6' : '#2481CC';
  const stopTextActive = isDark ? '#F1F5F9' : '#0F172A';
  const stopTextMuted = isDark ? '#94A3B8' : '#475569';

  return (
    <div
      className={`relative w-full ${heightClass} overflow-hidden rounded-xl border border-slate-200 dark:border-[#2B3848]`}
      style={{ backgroundColor: mapBg }}
      aria-label={`AFUSTA campus route map from ${from.name} to ${to.name}`}
    >
      <svg
        viewBox="0 0 200 110"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="img"
        aria-label="AFUSTA Campus Road Network"
      >
        <rect x="0" y="0" width="200" height="110" fill={mapBg} />

        {/* Campus block footprints */}
        <rect x="18" y="18" width="34" height="18" rx="3" fill={blockBg} />
        <rect x="66" y="16" width="44" height="15" rx="3" fill={blockBg} />
        <rect x="124" y="16" width="46" height="18" rx="3" fill={blockBg} />
        <rect x="20" y="48" width="32" height="24" rx="3" fill={blockBg} />
        <rect x="76" y="50" width="32" height="22" rx="3" fill={blockBg} />
        <rect x="122" y="40" width="26" height="18" rx="3" fill={blockBg} />
        <rect x="132" y="70" width="42" height="24" rx="3" fill={blockBg} />

        {/* Campus avenues */}
        {ROAD_SEGMENTS.map(([aId, bId]) => {
          const a = getCampusStop(aId);
          const b = getCampusStop(bId);
          if (!a || !b) return null;
          return (
            <line
              key={`${aId}-${bId}`}
              x1={sx(a.x)}
              y1={sy(a.y)}
              x2={sx(b.x)}
              y2={sy(b.y)}
              stroke={roadStroke}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          );
        })}

        {/* Active route path */}
        <line
          x1={fx}
          y1={fy}
          x2={tx}
          y2={ty}
          stroke={routeStroke}
          strokeWidth="2.8"
          strokeDasharray="4.5 3"
          strokeLinecap="round"
        />

        {/* All campus stops */}
        {CAMPUS_STOPS.map((stop) => {
          const isFrom = stop.id === from.id;
          const isTo = stop.id === to.id;
          const cx = sx(stop.x);
          const cy = sy(stop.y);
          const labelBelow = stop.y > 72;
          return (
            <g key={stop.id}>
              <circle
                cx={cx}
                cy={cy}
                r={isFrom || isTo ? 3.5 : 2}
                fill={isFrom ? (isDark ? '#F1F5F9' : '#0F172A') : isTo ? routeStroke : '#94A3B8'}
                stroke={isDark ? '#17212B' : '#FFFFFF'}
                strokeWidth="1.2"
              />
              <text
                x={cx}
                y={labelBelow ? cy + 8.5 : cy - 5.5}
                textAnchor="middle"
                fontSize="4.6"
                fontWeight={isFrom || isTo ? '700' : '500'}
                fill={isFrom || isTo ? stopTextActive : stopTextMuted}
              >
                {stop.shortName}
              </text>
            </g>
          );
        })}

        {/* Active Tricycle marker */}
        <g transform={`translate(${trikeX}, ${trikeY})`}>
          <circle
            cx="0"
            cy="0"
            r="5.5"
            fill={routeStroke}
            stroke={isDark ? '#17212B' : '#FFFFFF'}
            strokeWidth="1.6"
          />
          <path d="M -2.3 1.2 L -1.5 -1.6 L 1.5 -1.6 L 2.3 1.2 Z" fill="#FFFFFF" />
        </g>
      </svg>

      {/* Overlay route header */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 dark:bg-[#17212B]/95 backdrop-blur-md border border-slate-200 dark:border-[#2B3848] px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <MapPin className="h-3.5 w-3.5 text-[#2481CC] dark:text-[#4EA4F6] shrink-0" />
          <span className="truncate">
            {from.shortName} → {to.shortName}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 dark:bg-[#17212B]/95 backdrop-blur-md border border-sky-200 dark:border-[#2B3848] px-2.5 py-1 text-xs font-semibold text-[#1D6FB8] dark:text-[#4EA4F6] shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <Navigation className="h-3 w-3 text-[#2481CC] dark:text-[#4EA4F6] shrink-0" />
          <span>{statusLabel}</span>
        </div>
      </div>
    </div>
  );
}
