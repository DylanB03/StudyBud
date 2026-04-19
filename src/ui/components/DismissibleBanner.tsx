import { useEffect, useState, type ReactNode } from 'react';

import { cn } from '../theme/cn';

import { Icon } from './Icon';

type DismissibleBannerProps = {
  variant?: 'warning' | 'error' | 'info' | 'success';
  dismissKey: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

const VARIANT: Record<NonNullable<DismissibleBannerProps['variant']>, string> = {
  warning:
    'border-l-4 border-warning bg-warning/10 text-on-surface',
  error: 'border-l-4 border-error bg-error/10 text-on-surface',
  info: 'border-l-4 border-primary bg-primary/5 text-on-surface',
  success: 'border-l-4 border-success bg-success/10 text-on-surface',
};

const VARIANT_ICON: Record<NonNullable<DismissibleBannerProps['variant']>, string> = {
  warning: 'warning',
  error: 'error',
  info: 'info',
  success: 'check_circle',
};

export const DismissibleBanner = ({
  variant = 'warning',
  dismissKey,
  children,
  action = null,
  className = '',
}: DismissibleBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [dismissKey]);

  if (dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-card-sm px-4 py-3',
        VARIANT[variant],
        className,
      )}
    >
      <Icon name={VARIANT_ICON[variant]} size="sm" className="mt-0.5 shrink-0" />
      <div className="flex-1 font-body text-body-sm">{children}</div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss message"
          title="Dismiss message"
          className="rounded-full p-1 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
        >
          <Icon name="close" size="xs" />
        </button>
      </div>
    </div>
  );
};
