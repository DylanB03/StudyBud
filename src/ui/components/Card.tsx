import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../theme/cn';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
  interactive?: boolean;
  padded?: boolean;
  tone?: 'default' | 'lowest' | 'raised';
};

const TONE: Record<NonNullable<CardProps['tone']>, string> = {
  default: 'bg-surface-container-low',
  lowest: 'bg-surface-container-lowest',
  raised: 'bg-surface-container-high',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      elevated = false,
      interactive = false,
      padded = true,
      tone = 'lowest',
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-card text-on-surface transition-all duration-300',
          TONE[tone],
          padded && 'p-6',
          elevated && 'shadow-ambient dark:shadow-ambient-dark',
          interactive &&
            'group cursor-pointer hover:-translate-y-1 hover:shadow-elevated',
          className,
        )}
        {...rest}
      />
    );
  },
);
Card.displayName = 'Card';

type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...rest }, ref) => (
    <h3
      ref={ref}
      className={cn('font-display text-title-md text-on-surface', className)}
      {...rest}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

type CardBodyProps = HTMLAttributes<HTMLDivElement>;

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn('font-body text-body-md text-on-surface-variant', className)}
      {...rest}
    />
  ),
);
CardBody.displayName = 'CardBody';
