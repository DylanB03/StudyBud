import { useEffect } from 'react';

import { cn } from '../theme/cn';

import { Icon } from './Icon';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
};

type ToastProps = ToastItem & {
  onDismiss: (id: string) => void;
};

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'border-l-primary',
  success: 'border-l-success',
  warning: 'border-l-warning',
  error: 'border-l-error',
};

const TONE_ICON: Record<ToastTone, string> = {
  info: 'info',
  success: 'check_circle',
  warning: 'warning',
  error: 'error',
};

const TONE_ICON_CLASS: Record<ToastTone, string> = {
  info: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

export const Toast = ({
  id,
  tone,
  title,
  description,
  durationMs = 5000,
  onDismiss,
}: ToastProps) => {
  useEffect(() => {
    if (durationMs <= 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => onDismiss(id), durationMs);
    return () => window.clearTimeout(timer);
  }, [id, durationMs, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex min-w-[280px] max-w-md items-start gap-3 rounded-card-sm border-l-4 bg-surface-container-lowest px-4 py-3 shadow-ambient dark:shadow-ambient-dark',
        TONE_CLASS[tone],
      )}
    >
      <Icon
        name={TONE_ICON[tone]}
        size="sm"
        className={cn('mt-0.5', TONE_ICON_CLASS[tone])}
      />
      <div className="flex-1 text-left">
        <p className="font-body text-body-sm font-semibold text-on-surface">{title}</p>
        {description && (
          <p className="mt-0.5 font-body text-label-md text-on-surface-variant">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        aria-label="Dismiss notification"
      >
        <Icon name="close" size="xs" />
      </button>
    </div>
  );
};

type ToastStackProps = {
  items: ToastItem[];
  onDismiss: (id: string) => void;
};

export const ToastStack = ({ items, onDismiss }: ToastStackProps) => (
  <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
    {items.map((item) => (
      <Toast key={item.id} {...item} onDismiss={onDismiss} />
    ))}
  </div>
);
