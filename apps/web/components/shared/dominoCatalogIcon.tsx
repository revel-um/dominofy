'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { DominoCatalogEntry } from '@/dominos/dominos';

interface DominoCatalogIconProps {
  domino?: DominoCatalogEntry;
  badgeClassName?: string;
  iconClassName?: string;
}

export default function DominoCatalogIcon({
  domino,
  badgeClassName,
  iconClassName,
}: DominoCatalogIconProps) {
  if (!domino) return null;

  const Icon = domino.icon;

  return (
    <div
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-xl p-1.5 shadow-sm ring-1 ring-black/5',
        badgeClassName
      )}
      style={domino.badgeStyle}
    >
      <Icon
        className={cn(
          'h-full w-full',
          iconClassName
        )}
        style={domino.iconStyle}
      />
    </div>
  );
}
