/**
 * Escenarios de MOO-36 (hook validate-ac): la validación del formato de los criterios de aceptación
 * que hace el hook antes de que una historia se escriba en Linear.
 */
import { describe, expect, it } from 'vitest';

import {
  extractCriteriaSection,
  validateAcceptanceCriteria,
} from '../.claude/hooks/acceptance-criteria.ts';

const story = (criteria: string) =>
  `Como DJ quiero algo para algo.\n\n## Criterios de aceptación\n\n${criteria}\n\n## Definition of Done (Feature)\n\n- [ ] Algo`;

const VALID = `Scenario: Caso feliz
  Given el motor arrancado
  When el DJ mueve el fader
  Then la tira cambia de brillo
  And el visor también

Scenario: Caso límite (asumido)
  Given el motor sin tiras
  When el DJ mueve el fader
  Then no pasa nada
  But el panel no da error`;

describe('validateAcceptanceCriteria', () => {
  it('deja pasar criterios bien formados', () => {
    expect(validateAcceptanceCriteria(story(VALID))).toEqual([]);
  });

  it('deja pasar una issue sin sección de criterios', () => {
    expect(validateAcceptanceCriteria('Tarea: cambiar el wireframe.\n\n## Non-goals\n\n- Nada')).toEqual([]);
  });

  it('bloquea un escenario sin Then y dice cuál y qué falta', () => {
    const errors = validateAcceptanceCriteria(
      story('Scenario: Sin cierre\n  Given algo\n  When pasa algo'),
    );
    expect(errors).toEqual(['Escenario «Sin cierre»: falta el paso Then.']);
  });

  it('bloquea un paso que conserva un hueco de la plantilla', () => {
    const errors = validateAcceptanceCriteria(
      story('Scenario: Con hueco\n  Given …\n  When <acción del DJ>\n  Then algo'),
    );
    expect(errors).toEqual([
      'Escenario «Con hueco»: el paso Given está vacío o es un hueco de la plantilla.',
      'Escenario «Con hueco»: el paso When está vacío o es un hueco de la plantilla.',
    ]);
  });

  it('bloquea la plantilla de refine-story sin rellenar', () => {
    const template = `Scenario: <caso feliz, escrito por el usuario>
  Given …
  When …
  Then …`;
    const errors = validateAcceptanceCriteria(story(template));
    expect(errors).toHaveLength(4);
    expect(errors[0]).toBe('Escenario #1: el nombre está vacío o es un hueco de la plantilla.');
  });

  it('bloquea una sección sin escenarios', () => {
    expect(validateAcceptanceCriteria(story('Pendiente de refinar.'))).toEqual([
      'La sección «Criterios de aceptación» no tiene ningún «Scenario:».',
    ]);
  });

  it('bloquea pasos fuera de orden', () => {
    const errors = validateAcceptanceCriteria(
      story('Scenario: Al revés\n  When pasa algo\n  Given algo\n  Then resultado'),
    );
    expect(errors).toEqual(['Escenario «Al revés»: Given fuera de orden: va antes que When.']);
  });

  it('bloquea un escenario que se salta un paso', () => {
    const errors = validateAcceptanceCriteria(story('Scenario: Sin acción\n  Given algo\n  Then resultado'));
    expect(errors).toEqual(['Escenario «Sin acción»: falta el paso When.']);
  });

  it('bloquea un paso principal repetido', () => {
    const errors = validateAcceptanceCriteria(
      story('Scenario: Doble\n  Given algo\n  When pasa\n  Then uno\n  Then dos'),
    );
    expect(errors).toEqual(['Escenario «Doble»: Then repetido: usa And para continuarlo.']);
  });

  it('bloquea And al principio del escenario', () => {
    const errors = validateAcceptanceCriteria(
      story('Scenario: Sin abrir\n  And algo\n  Given algo\n  When pasa\n  Then resultado'),
    );
    expect(errors).toEqual([
      'Escenario «Sin abrir»: And no puede abrir el escenario: continúa un paso anterior.',
    ]);
  });

  it('bloquea pasos antes del primer escenario', () => {
    const errors = validateAcceptanceCriteria(story(`Given algo suelto\n\n${VALID}`));
    expect(errors).toEqual(['Paso «Given algo suelto» fuera de un escenario: falta la línea «Scenario:» antes.']);
  });

  it('acepta escenarios en lista o en un bloque de código, como los puede enviar el agente', () => {
    const fenced = '```gherkin\n' + VALID + '\n```';
    const listed = VALID.split('\n').map((line) => (line ? `- ${line.trim()}` : line)).join('\n');
    expect(validateAcceptanceCriteria(story(fenced))).toEqual([]);
    expect(validateAcceptanceCriteria(story(listed))).toEqual([]);
  });

  it('acepta saltos de línea de Windows', () => {
    expect(validateAcceptanceCriteria(story(VALID).replaceAll('\n', '\r\n'))).toEqual([]);
  });
});

describe('extractCriteriaSection', () => {
  it('corta la sección en el siguiente título de nivel 1 o 2', () => {
    const section = extractCriteriaSection(story('Scenario: Uno\n### Nota\nGiven algo'));
    expect(section?.join('\n')).toContain('### Nota');
    expect(section?.join('\n')).not.toContain('Definition of Done');
  });
});
