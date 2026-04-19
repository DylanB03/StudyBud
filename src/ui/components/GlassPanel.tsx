import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../theme/cn';

type GlassPanelProps = HTMLAttributes<HTMLDivElement>;

/**
 * A glassmorphic surface matching the stitch references: blurred translucent
 * bg over the underlying content. Used for the top nav, selection popups,
 * and floating panels.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'backdrop-blur-glass supports-[backdrop-filter]:bg-surface/80 bg-surface/95 dark:supports-[backdrop-filter]:bg-surface-bright/60 dark:bg-surface-bright/85',
        className,
      )}
      {...rest}
    />
  ),
);
GlassPanel.displayName = 'GlassPanel';
