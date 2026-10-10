import * as React from 'react';
import { cn } from 'cn';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 px-3 py-1 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium w-full min-w-0 rounded-lg border border-input bg-card text-base text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
