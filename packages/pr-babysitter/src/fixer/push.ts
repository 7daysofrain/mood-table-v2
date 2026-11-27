/**
 * Subir los arreglos a la rama de la PR (change pr-fixer, decisión 6). El push es normal, sin
 * forzar: si la rama ha avanzado mientras el *fixer* arreglaba (un push del mantenedor), GitHub lo
 * rechaza y no se pisa nada. El token de instalación de la App va en la URL del remoto, y ningún
 * error lo deja ver.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type PushResult = { pushed: true; sha: string } | { pushed: false; reason: 'branchMoved' };

/** La URL de `repository` (`owner/name`) en GitHub, con el token de instalación como credencial. */
export function authenticatedRemote(repository: string, token: string): string {
  return `https://x-access-token:${token}@github.com/${repository}.git`;
}

/** Quita de un texto cualquier credencial que vaya en una URL. */
function redact(text: string): string {
  return text.replace(/\/\/[^/@\s]*@/g, '//***@');
}

/** Lo que git escribe cuando el remoto tiene commits que el clon local no tiene. */
const BRANCH_MOVED = /\[rejected\]|non-fast-forward|fetch first/;

/**
 * Sube el `HEAD` del clon `repoDir` a `branch` del remoto `remote`, sin forzar. Si la rama ha
 * avanzado, no sube nada y lo dice; cualquier otro fallo lanza, sin credenciales en el mensaje.
 */
export async function pushBranch(repoDir: string, remote: string, branch: string): Promise<PushResult> {
  const { stdout } = await run('git', ['rev-parse', 'HEAD'], { cwd: repoDir });
  const sha = stdout.trim();
  try {
    await run('git', ['push', '--porcelain', remote, `HEAD:refs/heads/${branch}`], {
      cwd: repoDir,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  } catch (error) {
    const { stdout: out = '', stderr = '', message } = error as { stdout?: string; stderr?: string; message: string };
    if (BRANCH_MOVED.test(`${out}\n${stderr}`)) return { pushed: false, reason: 'branchMoved' };
    // eslint-disable-next-line preserve-caught-error -- el error de git lleva el token en su comando y en su mensaje
    throw new Error(`git push a ${branch} ha fallado: ${redact(stderr.trim() || message)}`);
  }
  return { pushed: true, sha };
}
