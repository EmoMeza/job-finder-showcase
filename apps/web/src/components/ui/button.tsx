import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Slot } from 'radix-ui';

/**
 * Tres niveles de acción, distinguibles a simple vista:
 * - default: acción principal (petróleo sólido).
 * - outline: acción secundaria (borde petróleo sobre blanco).
 * - ghost: acción terciaria (texto petróleo subrayado, nunca texto suelto sin pista).
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-offset-1 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-petroleo-oscuro',
        outline: 'border-primary bg-card text-primary hover:bg-secondary',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost:
          'text-primary underline decoration-primary/35 underline-offset-4 hover:bg-secondary hover:decoration-primary',
        destructive:
          'text-destructive underline decoration-destructive/35 underline-offset-4 hover:bg-destructive/10 hover:decoration-destructive',
        link: 'text-primary underline underline-offset-4 hover:decoration-2',
      },
      size: {
        default: 'h-9 gap-1.5 px-3.5',
        xs: "h-7 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-2.5 text-[0.85rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-11 gap-2 px-5 text-base',
        icon: 'size-9',
        'icon-xs': "size-7 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
