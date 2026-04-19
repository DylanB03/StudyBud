import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AppInfo } from '../../shared/ipc';
import type { ToastItem, ToastTone } from '../components/Toast';

import {
  createNotificationId,
  getNavigatorOnline,
  getStudyBudApi,
  type View,
} from './helpers';

type Notification = ToastItem;

type AppStateValue = {
  activeView: View;
  setActiveView: (view: View) => void;
  notifications: Notification[];
  pushNotification: (
    tone: ToastTone,
    title: string,
    description?: string,
    durationMs?: number,
  ) => string;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  isOnline: boolean;
  appInfo: AppInfo | null;
  appInfoError: string | null;
  refreshAppInfo: () => Promise<void>;
};

const AppStateContext = createContext<AppStateValue | null>(null);

type AppStateProviderProps = {
  children: ReactNode;
  initialView?: View;
};

export const AppStateProvider = ({
  children,
  initialView = 'library',
}: AppStateProviderProps) => {
  const [activeView, setActiveView] = useState<View>(initialView);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(getNavigatorOnline);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [appInfoError, setAppInfoError] = useState<string | null>(null);

  const pushNotification = useCallback(
    (tone: ToastTone, title: string, description?: string, durationMs?: number) => {
      const id = createNotificationId();
      setNotifications((prev) => [...prev, { id, tone, title, description, durationMs }]);
      return id;
    },
    [],
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const refreshAppInfo = useCallback(async () => {
    const api = getStudyBudApi();
    if (!api) {
      setAppInfoError('StudyBud runtime is not available in this window.');
      return;
    }
    try {
      const info = await api.getAppInfo();
      setAppInfo(info);
      setAppInfoError(null);
    } catch (error) {
      setAppInfoError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    refreshAppInfo();
  }, [refreshAppInfo]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      activeView,
      setActiveView,
      notifications,
      pushNotification,
      dismissNotification,
      clearNotifications,
      isOnline,
      appInfo,
      appInfoError,
      refreshAppInfo,
    }),
    [
      activeView,
      notifications,
      pushNotification,
      dismissNotification,
      clearNotifications,
      isOnline,
      appInfo,
      appInfoError,
      refreshAppInfo,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
};

export const useAppState = (): AppStateValue => {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used inside <AppStateProvider>');
  }
  return ctx;
};
