import { useEffect, useState } from 'react';

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  variant: 'info' | 'success' | 'warning' | 'error';
  createdAt: number;
  actionLabel?: string;
  onAction?: (() => void) | null;
};

type NotificationCenterProps = {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
};

const DISMISSED_NOTIFICATIONS_STORAGE_KEY = 'studybud.dismissedNotifications';

const formatTimestamp = (createdAt: number): string => {
  return new Date(createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const NotificationCenter = ({
  notifications,
  onDismiss,
  onClearAll,
}: NotificationCenterProps) => {
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = window.localStorage.getItem(
        DISMISSED_NOTIFICATIONS_STORAGE_KEY,
      );
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });

  const visibleNotifications = notifications.filter(
    (notification) => !dismissedIds.includes(notification.id),
  );

  useEffect(() => {
    if (visibleNotifications.length === 0) {
      setOpen(false);
    }
  }, [visibleNotifications.length]);

  useEffect(() => {
    setDismissedIds((previous) =>
      previous.filter((id) =>
        notifications.some((notification) => notification.id === id),
      ),
    );
  }, [notifications]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      DISMISSED_NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(dismissedIds),
    );
  }, [dismissedIds]);

  return (
    <div className="notification-center">
      <button
        type="button"
        className={`notification-bell${visibleNotifications.length > 0 ? ' has-notifications' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={`Notifications${visibleNotifications.length > 0 ? ` (${visibleNotifications.length})` : ''}`}
        title="Notifications"
      >
        <span className="notification-bell-icon" aria-hidden="true">
          bell
        </span>
        {visibleNotifications.length > 0 ? (
          <>
            <span className="notification-bell-count">{visibleNotifications.length}</span>
            <span className="notification-bell-dot" aria-hidden="true" />
          </>
        ) : null}
      </button>

      {open ? (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <div>
              <h3>Notifications</h3>
              <p>{visibleNotifications.length === 0 ? 'No current notifications.' : `${visibleNotifications.length} active`}</p>
            </div>
            {visibleNotifications.length > 0 ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setDismissedIds(
                    visibleNotifications.map((notification) => notification.id),
                  );
                  onClearAll();
                }}
              >
                Clear all
              </button>
            ) : null}
          </div>

          {visibleNotifications.length === 0 ? (
            <div className="empty-state notification-empty-state">
              You are all caught up.
            </div>
          ) : (
            <div className="notification-list">
              {visibleNotifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`notification-card notification-${notification.variant}`}
                >
                  <div className="notification-card-header">
                    <div>
                      <strong>{notification.title}</strong>
                      <span>{formatTimestamp(notification.createdAt)}</span>
                    </div>
                    <button
                      type="button"
                      className="banner-dismiss"
                      onClick={() => {
                        setDismissedIds((previous) =>
                          previous.includes(notification.id)
                            ? previous
                            : [...previous, notification.id],
                        );
                        onDismiss(notification.id);
                      }}
                      aria-label="Dismiss notification"
                      title="Dismiss notification"
                    >
                      ×
                    </button>
                  </div>
                  <p>{notification.message}</p>
                  {notification.actionLabel && notification.onAction ? (
                    <div className="notification-card-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={notification.onAction}
                      >
                        {notification.actionLabel}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
