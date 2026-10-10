import { text } from 'node:stream/consumers';

/** Pide una contraseña sin mostrarla en pantalla (requiere una terminal interactiva). */
export function promptHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  // Modo raw antes de mostrar la pregunta: así la terminal nunca hace eco de lo que se tipea.
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  stdout.write(question);

  return new Promise((resolve) => {
    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdout.write('\n');
          process.exit(130); // Ctrl+C
        }
        value = char === '\u007f' ? value.slice(0, -1) : value + char;
      }
    };
    stdin.on('data', onData);
  });
}

/**
 * Pide una contraseña nueva con confirmación. Sin terminal interactiva
 * (ej. `echo clave | node dist/cli.js ...`) usa la primera línea de stdin.
 */
export async function promptNewPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    return (await text(process.stdin)).split(/\r?\n/)[0] ?? '';
  }
  const password = await promptHidden('Contraseña: ');
  const confirmation = await promptHidden('Repite la contraseña: ');
  if (password !== confirmation) {
    throw new Error('Las contraseñas no coinciden');
  }
  return password;
}
