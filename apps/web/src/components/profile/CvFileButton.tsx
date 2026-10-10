import { Upload } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { Button, type buttonVariants } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';

/** Botón que abre el selector de archivos para un PDF. */
export function CvFileButton({
  label,
  onFile,
  disabled,
  variant,
}: {
  label: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  variant?: VariantProps<typeof buttonVariants>['variant'];
}) {
  const input = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite volver a elegir el mismo archivo
    if (file) onFile(file);
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Archivo del CV"
        onChange={handleChange}
      />
      <Button variant={variant} onClick={() => input.current?.click()} disabled={disabled}>
        <Upload />
        {label}
      </Button>
    </>
  );
}
