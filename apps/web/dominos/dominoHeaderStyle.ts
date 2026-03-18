import type { CSSProperties } from 'react';

import dominoCatalog from './dominos';

export function getExpandedDominoHeaderStyle(id: string): CSSProperties {
  const domino = dominoCatalog.find((entry) => entry.id === id);

  return {
    borderRadius: '0.23rem 0.23rem 0 0',
    background: domino?.badgeStyle?.background ?? '#6366f1',
    border: domino?.badgeStyle?.border,
    color: domino?.iconStyle?.color ?? '#ffffff',
  };
}
