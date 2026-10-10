import * as React from 'react';
import { cn } from 'cn';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 px-3 py-2 w-full min-w-0 rounded-lg border border-input bg-card text-base text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
