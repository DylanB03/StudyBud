import type { HTMLAttributes } from 'react';

import { cn } from '../theme/cn';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type IconProps = HTMLAttributes<HTMLSpanElement> & {
  name: string;
  size?: IconSize;
  filled?: boolean;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
};

const SIZE_CLASS: Record<IconSize, string> = {
  xs: 'text-base',
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

export const Icon = ({
  name,
  size = 'md',
  filled = false,
  weight = 400,
  className,
  style,
  ...rest
}: IconProps) => {
  return (
    <span
      aria-hidden
      {...rest}
      className={cn('material-symbols-outlined', SIZE_CLASS[size], className)}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
        ...style,
      }}
    >
      {name}
    </span>
  );
};
