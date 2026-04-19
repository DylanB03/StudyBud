import { useCallback, useEffect, useRef } from 'react';

import { Icon } from '../../components/Icon';
import { Tooltip } from '../../components/Tooltip';
import {
  CHAT_PANEL_MAX_WIDTH,
  CHAT_PANEL_MIN_WIDTH,
} from '../../state/helpers';
import { useWorkspace } from '../../state/WorkspaceState';
import { cn } from '../../theme/cn';
import { ChatPanel } from './ChatPanel';
import { ResearchPanel } from './ResearchPanel';

export const RightRail = () => {
  const {
    rightRailTab,
    setRightRailTab,
    chatPanelWidth,
    setChatPanelWidth,
  } = useWorkspace();

  const asideRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  const stopDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = null;
    document.body.classList.remove('select-none');
    document.body.style.removeProperty('cursor');
  }, []);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const drag = draggingRef.current;
      if (!drag) return;
      const delta = drag.startX - event.clientX;
      const next = drag.startWidth + delta;
      setChatPanelWidth(next);
    };
    const handleUp = () => stopDrag();
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [setChatPanelWidth, stopDrag]);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    draggingRef.current = {
      startX: event.clientX,
      startWidth: chatPanelWidth,
    };
    document.body.classList.add('select-none');
    document.body.style.cursor = 'col-resize';
  };

  const handleKeyResize = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setChatPanelWidth(chatPanelWidth + step);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setChatPanelWidth(chatPanelWidth - step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setChatPanelWidth(CHAT_PANEL_MAX_WIDTH);
    } else if (event.key === 'End') {
      event.preventDefault();
      setChatPanelWidth(CHAT_PANEL_MIN_WIDTH);
    }
  };

  return (
    <div className="relative flex h-full shrink-0">
      <Tooltip
        content="Drag to resize · Shift+Arrow for bigger steps"
        side="left"
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={chatPanelWidth}
          aria-valuemin={CHAT_PANEL_MIN_WIDTH}
          aria-valuemax={CHAT_PANEL_MAX_WIDTH}
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyResize}
          className="group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-outline-variant/10 transition-colors hover:bg-primary/30 focus-visible:bg-primary/40 focus-visible:outline-none"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 flex h-10 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant opacity-0 shadow-soft ring-1 ring-outline-variant/30 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <Icon name="drag_indicator" size="xs" />
          </span>
        </div>
      </Tooltip>

      <aside
        ref={asideRef}
        style={{ width: `${chatPanelWidth}px` }}
        className="flex h-full shrink-0 flex-col border-l border-outline-variant/20 bg-surface-container-high"
      >
        <div className="flex border-b border-outline-variant/20">
          <RailTabButton
            label="Chat"
            icon="forum"
            active={rightRailTab === 'chat'}
            onClick={() => setRightRailTab('chat')}
          />
          <RailTabButton
            label="Research"
            icon="travel_explore"
            active={rightRailTab === 'research'}
            onClick={() => setRightRailTab('research')}
          />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {rightRailTab === 'chat' ? <ChatPanel /> : <ResearchPanel />}
        </div>
      </aside>
    </div>
  );
};

type RailTabButtonProps = {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
};

const RailTabButton = ({ label, icon, active, onClick }: RailTabButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex-1 py-4 font-display text-body-xs font-bold uppercase tracking-widest transition-colors',
      active
        ? 'border-b-2 border-primary text-primary'
        : 'border-b-2 border-transparent text-on-surface-variant/60 hover:text-on-surface-variant',
    )}
  >
    <span className="inline-flex items-center gap-1.5">
      <Icon name={icon} size="sm" />
      {label}
    </span>
  </button>
);
