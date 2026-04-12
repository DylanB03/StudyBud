import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type DismissibleBannerProps = {
  variant?: 'warning' | 'error';
  dismissKey: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
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
    <div className={`${variant}-banner banner-shell ${className}`.trim()}>
      <div className="banner-main">{children}</div>
      <div className="banner-actions">
        {action}
        <button
          type="button"
          className="banner-dismiss"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss message"
          title="Dismiss message"
        >
          ×
        </button>
      </div>
    </div>
  );
};
