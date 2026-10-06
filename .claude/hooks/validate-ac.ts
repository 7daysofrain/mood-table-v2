/**
 * Hook `PreToolUse` de Claude Code sobre `mcp__linear__save_issue` (MOO-36): si la descripción que se
 * va a guardar tiene criterios de aceptación mal formados, bloquea la llamada (código 2) y le dice al
 * agente qué corregir antes de que llegue la confirmación `ask`. Lo demás pasa sin tocar.
 */
import { text } from 'node:stream/consumers';

import { validateAcceptanceCriteria } from './acceptance-criteria.ts';

interface HookInput {
  tool_input?: { description?: unknown };
}

const input = JSON.parse(await text(process.stdin)) as HookInput;
const description = input.tool_input?.description;

if (typeof description === 'string') {
  const errors = validateAcceptanceCriteria(description);
  if (errors.length > 0) {
    process.stderr.write(
      `Criterios de aceptación mal formados; corrígelos antes de guardar en Linear:\n${errors.map((e) => `- ${e}`).join('\n')}\n`,
    );
    process.exit(2);
  }
}
