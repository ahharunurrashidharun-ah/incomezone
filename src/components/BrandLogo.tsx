import React from 'react';

export const BRAND_LOGO_SRC = '/assets/aistudio/1795356168824_9e1cf2d3.jpg';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-11 w-[74px]',
  md: 'h-12 w-[82px] sm:h-13 sm:w-[88px]',
  lg: 'h-14 w-[96px] sm:h-16 sm:w-[108px]',
};

export default function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-white overflow-hidden border border-slate-200/90 dark:border-amber-400/35 shadow-sm shadow-slate-200/70 dark:shadow-purple-950/60 shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      <img
        src={BRAND_LOGO_SRC}
        alt="IncomeZone - Microjobs Platform"
        className="w-full h-full object-cover object-center scale-[1.68] pointer-events-none"
      />
    </div>
  );
}
