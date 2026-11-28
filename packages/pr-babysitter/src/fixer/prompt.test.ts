import { describe, expect, it } from 'vitest';

import { codex, lint, sonar } from './fixtures.ts';
import { fixPrompt } from './prompt.ts';

const pr = { title: 'feat(engine): efecto nuevo', description: 'Añade el efecto de barrido.' };

describe('lo que recibe el agente (design.md decisión 12)', () => {
  it('el alcance de la PR y un solo hallazgo, sin commit ni push', () => {
    const prompt = fixPrompt(pr, lint);

    expect(prompt).toContain('feat(engine): efecto nuevo');
    expect(prompt).toContain('Añade el efecto de barrido.');
    expect(prompt).toMatch(/do not commit/i);
    expect(prompt).toMatch(/do not push/i);
  });

  it('no arregla otros problemas que vea, aunque sean fallos claros: algunos los decide el mantenedor', () => {
    const prompt = fixPrompt(pr, lint);

    expect(prompt).toMatch(/do not fix anything else/i);
    expect(prompt).toMatch(/even an obvious bug/i);
    expect(prompt).toMatch(/maintainer/i);
  });

  it('una comprobación, con su resumen y cada error que señala', () => {
    const prompt = fixPrompt(pr, lint);

    expect(prompt).toContain('`lint`');
    expect(prompt).toContain('1 error');
    expect(prompt).toContain("src/a.ts:3 no-unused-vars: 'x' is unused");
  });

  it('una comprobación sin contexto lo dice', () => {
    expect(fixPrompt(pr, { ...lint, context: { state: 'unreadable' } })).toMatch(/no log/i);
  });

  it('una incidencia de SonarQube, con su regla, su mensaje y su código', () => {
    const prompt = fixPrompt(pr, sonar);

    expect(prompt).toContain('typescript:S3358');
    expect(prompt).toContain('Ternary operators should not be nested');
    expect(prompt).toContain('src/b.ts:12');
    expect(prompt).toContain('const x = a ? b : c ? d : e;');
  });

  it('un comentario del revisor, con su texto y el trozo de diff que comenta', () => {
    const prompt = fixPrompt(pr, codex);

    expect(prompt).toContain('Codex');
    expect(prompt).toContain('src/c.ts:7');
    expect(prompt).toContain('Handle the empty list');
    expect(prompt).toContain('This throws when the list is empty.');
    expect(prompt).toContain('+const first = list[0].name;');
  });

  it('un comentario de un push anterior, con el código de ahora', () => {
    const prompt = fixPrompt(pr, { ...codex, earlierPush: { sha: 'old', code: '7 >> const first = list.at(0);' } });

    expect(prompt).toContain('7 >> const first = list.at(0);');
  });
});
