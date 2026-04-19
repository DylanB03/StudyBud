import { useAppState } from '../state/AppState';

import { ToastStack } from './Toast';

export const NotificationCenter = () => {
  const { notifications, dismissNotification } = useAppState();
  return <ToastStack items={notifications} onDismiss={dismissNotification} />;
};
