import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'
type Size = 'default' | 'sm' | 'lg'

// A status is said in coloured words with a dot in front, the way a margin
// note is written. It used to be a filled pill; a page of pills reads as a
// template, and the words alone carry the meaning.
const VARIANTS: Record<Variant, string> = {
  default: 'text-primary',
  secondary: 'text-muted-foreground',
  destructive: 'text-destructive',
  outline: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
}

const SIZES: Record<Size, string> = {
  default: 'text-sm',
  sm: 'text-xs',
  lg: 'text-base',
}

export interface BadgeProps extends ComponentProps<'span'> {
  variant?: Variant
  size?: Size
}

export function Badge({ className, variant = 'default', size = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-current',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}
