import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '../theme/cn';

const FIELD_BASE =
  'w-full rounded-xl border-none bg-surface-container-highest px-4 py-2.5 font-body text-body-md text-on-surface placeholder:text-on-surface-variant/70 outline-none ring-1 ring-inset ring-transparent transition-all focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50';

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, invalid, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(FIELD_BASE, invalid && 'ring-2 ring-error/60', className)}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        FIELD_BASE,
        'min-h-[96px] resize-none leading-relaxed',
        invalid && 'ring-2 ring-error/60',
        className,
      )}
      {...rest}
    />
  ),
);
Textarea.displayName = 'Textarea';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn(FIELD_BASE, 'appearance-none pr-10', className)}
      {...rest}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const FieldLabel = ({ className, ...rest }: LabelProps) => (
  <label
    className={cn(
      'font-body text-label-md font-medium text-on-surface',
      className,
    )}
    {...rest}
  />
);

type FieldGroupProps = {
  label?: string;
  description?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
};

export const FieldGroup = ({
  label,
  description,
  error,
  htmlFor,
  className,
  children,
}: FieldGroupProps) => (
  <div className={cn('flex flex-col gap-1.5', className)}>
    {label && <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>}
    {children}
    {description && !error && (
      <p className="font-body text-label-sm text-on-surface-variant">
        {description}
      </p>
    )}
    {error && <p className="font-body text-label-sm text-error">{error}</p>}
  </div>
);
