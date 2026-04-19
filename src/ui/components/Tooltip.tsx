import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';

import { cn } from '../theme/cn';

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 overflow-hidden rounded-lg bg-inverse-surface px-3 py-1.5 font-body text-label-sm text-inverse-on-surface shadow-ambient dark:shadow-ambient-dark',
      'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=delayed-open]:fade-in',
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = 'TooltipContent';

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
  className?: string;
  disabled?: boolean;
};

/**
 * Convenience wrapper so we don't have to stack Provider/Root/Trigger/Content
 * at every callsite. `TooltipProvider` still needs to be rendered high in the
 * tree once to set the shared delay, but this composes the rest.
 */
export const Tooltip = ({
  content,
  children,
  side = 'top',
  delayDuration = 150,
  className,
  disabled,
}: TooltipProps) => {
  if (disabled) {
    return <>{children}</>;
  }
  return (
    <TooltipRoot delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  );
};
