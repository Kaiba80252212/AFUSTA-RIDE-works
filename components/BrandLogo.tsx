'use client';

import Image from 'next/image';
import { AFUSTA_LOGO_PATH } from '@/lib/media';

interface BrandLogoProps {
  variant?: 'dark' | 'light' | 'auto';
  size?: 'sm' | 'md';
}

export function BrandLogo({ variant = 'dark', size = 'md' }: BrandLogoProps) {
  const iconSize = size === 'sm' ? 34 : 40;
  const textColor =
    variant === 'light'
      ? 'text-slate-900'
      : variant === 'auto'
      ? 'text-slate-900 dark:text-white'
      : 'text-white';
  const accentColor =
    variant === 'light'
      ? 'text-emerald-600'
      : variant === 'auto'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-emerald-400';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <span
        className="relative overflow-hidden rounded-xl border border-emerald-500/50 bg-[#0B1713] shrink-0"
        style={{ width: iconSize, height: iconSize }}
      >
        <Image
          src={AFUSTA_LOGO_PATH}
          alt="AFUSTA Ride Logo"
          fill
          sizes="40px"
          referrerPolicy="no-referrer"
          className="object-cover"
        />
      </span>
      <span
        className={`font-bold tracking-tight leading-none ${
          size === 'sm' ? 'text-base' : 'text-lg'
        } ${textColor}`}
      >
        AFUSTA <span className={accentColor}>Ride</span>
      </span>
    </span>
  );
}
