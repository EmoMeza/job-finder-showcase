import { spawn } from 'node:child_process';

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options: { input?: string; timeoutMs: number },
) => Promise<CommandResult>;

export const COMMAND_RUNNER = Symbol('COMMAND_RUNNER');

/** Ejecuta un comando sin shell (sin riesgo de inyección) y junta su salida. */
export const spawnCommand: CommandRunner = (command, args, { input, timeoutMs }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });

    child.stdin.end(input ?? '');
  });
