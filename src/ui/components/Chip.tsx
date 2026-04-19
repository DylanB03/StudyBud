import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../theme/cn';

export type ChipTone =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: ChipTone;
  leading?: ReactNode;
  trailing?: ReactNode;
  interactive?: boolean;
};

const TONE: Record<ChipTone, string> = {
  default:
    'bg-surface-container-high text-on-surface-variant',
  primary: 'bg-primary/10 text-primary',
  secondary:
    'bg-secondary-container/60 text-on-secondary-container dark:bg-secondary-container/60 dark:text-on-secondary-container',
  tertiary: 'bg-tertiary-fixed text-on-tertiary-fixed',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-on-surface',
  error: 'bg-error/15 text-error',
  info: 'bg-primary-fixed text-on-primary-fixed',
};

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(
  (
    { tone = 'default', leading, trailing, interactive, className, children, ...rest },
    ref,
  ) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 font-body text-label-sm font-medium',
        TONE[tone],
        interactive &&
          'cursor-pointer transition-colors hover:bg-opacity-80 active:scale-[0.97]',
        className,
      )}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </span>
  ),
);
Chip.displayName = 'Chip';
