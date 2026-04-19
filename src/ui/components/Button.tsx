import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../theme/cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ghost'
  | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  asChild?: boolean;
  fullWidth?: boolean;
};

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 font-body font-semibold transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]';

const SIZE: Record<ButtonSize, string> = {
  sm: 'text-label-md px-4 py-1.5 h-8',
  md: 'text-body-sm px-6 py-2.5 h-10',
  lg: 'text-body-md px-8 py-3 h-12',
  icon: 'h-10 w-10 p-0',
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'rounded-button bg-gradient-to-br from-primary to-secondary text-on-primary shadow-ambient hover:shadow-elevated',
  secondary:
    'rounded-button bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
  tertiary:
    'rounded-button bg-transparent text-primary hover:bg-primary/10',
  ghost:
    'rounded-button bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
  danger:
    'rounded-button bg-error text-on-error hover:bg-error-dim shadow-ambient',
};

const Spinner = () => (
  <span
    aria-hidden
    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
  />
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leadingIcon,
      trailingIcon,
      asChild = false,
      fullWidth = false,
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) => {
    const Component: React.ElementType = asChild ? Slot : 'button';
    return (
      <Component
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          BASE,
          SIZE[size],
          VARIANT[variant],
          fullWidth && 'w-full',
          className,
        )}
        {...rest}
      >
        {loading ? <Spinner /> : leadingIcon}
        {size !== 'icon' && children}
        {!loading && trailingIcon}
      </Component>
    );
  },
);
Button.displayName = 'Button';
