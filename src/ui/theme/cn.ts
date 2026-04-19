import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compose class names from conditionals / arrays / strings and resolve
 * Tailwind conflicts so last-write-wins (e.g. `bg-surface bg-primary` ->
 * `bg-primary`). Use this in every component that accepts `className`.
 */
export const cn = (...inputs: ClassValue[]): string => {
  return twMerge(clsx(inputs));
};
