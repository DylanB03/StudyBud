import { type ReactNode } from 'react';

import { cn } from '../theme/cn';

import { Chip } from './Chip';
import { GlassPanel } from './GlassPanel';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

export type TopNavItem = {
  id: string;
  label: string;
  icon: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

type TopNavProps = {
  items: TopNavItem[];
  leading?: ReactNode;
  trailing?: ReactNode;
  subjectName?: string | null;
  className?: string;
};

export const TopNav = ({
  items,
  leading,
  trailing,
  subjectName,
  className,
}: TopNavProps) => (
  <GlassPanel
    className={cn(
      'sticky top-0 z-40 flex items-center gap-4 border-b border-outline-variant/30 px-6 py-3',
      className,
    )}
  >
    <div className="flex items-center gap-3">
      {leading ?? (
        <>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-on-primary">
            <Icon name="bolt" size="md" filled />
          </div>
          <div className="leading-tight">
            <p className="font-display text-title-sm text-on-surface">StudyBud</p>
            <p className="font-body text-label-sm text-on-surface-variant">
              Focused learning workspace
            </p>
          </div>
        </>
      )}
      {subjectName && (
        <>
          <span
            aria-hidden
            className="mx-2 h-6 w-px bg-outline-variant/60"
          />
          <Chip tone="primary" leading={<Icon name="folder_open" size="xs" />}>
            {subjectName}
          </Chip>
        </>
      )}
    </div>

    <nav className="ml-auto flex items-center gap-1">
      {items.map((item) => (
        <Tooltip key={item.id} content={item.label}>
          <button
            type="button"
            onClick={item.onClick}
            disabled={item.disabled}
            aria-label={item.label}
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-label-md font-medium text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              item.isActive &&
                'bg-surface-container-lowest text-primary shadow-ambient dark:shadow-ambient-dark',
            )}
          >
            <Icon name={item.icon} size="sm" filled={item.isActive} />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        </Tooltip>
      ))}
    </nav>

    {trailing && <div className="flex items-center gap-2">{trailing}</div>}
  </GlassPanel>
);
