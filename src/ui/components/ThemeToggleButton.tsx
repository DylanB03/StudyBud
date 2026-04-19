import { useTheme } from '../theme/ThemeProvider';

import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

export const ThemeToggleButton = () => {
  const { resolved, toggle } = useTheme();
  return (
    <Tooltip content={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle theme"
        className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Icon name={resolved === 'dark' ? 'light_mode' : 'dark_mode'} size="md" />
      </button>
    </Tooltip>
  );
};
