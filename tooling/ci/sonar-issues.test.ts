/**
 * Parte pura de la comprobación de incidencias nuevas de SonarQube (specs/quality-gates, design.md
 * decisión 3): leer el informe del escáner, decidir qué hacer con el estado del análisis y convertir
 * la respuesta de `api/issues/search` en el resultado de la comprobación.
 */
import { describe, expect, it } from 'vitest';

import {
  issueSeverity,
  type IssuesSearchResponse,
  type SonarIssue,
  nextStepForCeTask,
  parseReportTask,
  summarizeIssues,
  toAnnotations,
  toLogLine,
  withoutRunnerCommands,
} from './sonar-issues.ts';

const REPORT_TASK = `organization=7daysofrain
projectKey=7daysofrain_mood-table-v2
serverUrl=https://sonarcloud.io
dashboardUrl=https://sonarcloud.io/dashboard?id=7daysofrain_mood-table-v2&pullRequest=12
ceTaskId=AZm1
ceTaskUrl=https://sonarcloud.io/api/ce/task?id=AZm1
`;

const PR = { serverUrl: 'https://sonarcloud.io', projectKey: '7daysofrain_mood-table-v2', pullRequest: '12' };

describe('leer el informe del escáner', () => {
  it('devuelve la URL de la tarea de análisis, el servidor y el proyecto', () => {
    expect(parseReportTask(REPORT_TASK)).toEqual({
      ceTaskUrl: 'https://sonarcloud.io/api/ce/task?id=AZm1',
      serverUrl: 'https://sonarcloud.io',
      projectKey: '7daysofrain_mood-table-v2',
    });
  });

  it('acepta finales de línea de Windows', () => {
    expect(parseReportTask(REPORT_TASK.replaceAll('\n', '\r\n')).ceTaskUrl).toBe(
      'https://sonarcloud.io/api/ce/task?id=AZm1',
    );
  });

  it('falla con un mensaje claro si el informe no trae la URL', () => {
    expect(() => parseReportTask('projectKey=x\nserverUrl=https://sonarcloud.io\n')).toThrow(
      /ceTaskUrl/,
    );
  });
});

describe('qué hacer con el estado del análisis', () => {
  it.each(['PENDING', 'IN_PROGRESS'])('sigue esperando si está en %s', (status) => {
    expect(nextStepForCeTask(status)).toEqual({ kind: 'wait' });
  });

  it('continúa cuando el análisis ha terminado bien', () => {
    expect(nextStepForCeTask('SUCCESS')).toEqual({ kind: 'continue' });
  });

  it.each(['FAILED', 'CANCELED'])(
    'falla diciendo que ha fallado el análisis, no las incidencias, si está en %s',
    (status) => {
      const step = nextStepForCeTask(status);
      expect(step.kind).toBe('fail');
      expect(step.kind === 'fail' && step.message).toMatch(/análisis/);
      expect(step.kind === 'fail' && step.message).toContain(status);
    },
  );

  it('falla ante un estado desconocido en lugar de darlo por bueno', () => {
    expect(nextStepForCeTask('RARO').kind).toBe('fail');
  });
});

describe('resultado a partir de las incidencias de la PR', () => {
  it('pasa si la PR no tiene incidencias abiertas', () => {
    const response: IssuesSearchResponse = { paging: { total: 0 }, issues: [] };
    const result = summarizeIssues(response, PR);
    expect(result.passed).toBe(true);
    expect(result.lines.join('\n')).toMatch(/0 incidencias nuevas/);
  });

  it('falla y lista cada incidencia con regla, fichero:línea, mensaje y enlace', () => {
    const response: IssuesSearchResponse = {
      paging: { total: 2 },
      issues: [
        {
          key: 'AX1',
          rule: 'typescript:S1854',
          severity: 'MAJOR',
          component: '7daysofrain_mood-table-v2:packages/engine/src/core/loop.ts',
          line: 42,
          message: 'Remove this useless assignment to variable "x".',
        },
        {
          key: 'AX2',
          rule: 'typescript:S1128',
          severity: 'MINOR',
          component: '7daysofrain_mood-table-v2:tooling/ci/sonar-issues.ts',
          message: 'Remove this unused import.',
        },
      ],
    };
    const result = summarizeIssues(response, PR);
    expect(result.passed).toBe(false);
    const report = result.lines.join('\n');
    expect(report).toMatch(/2 incidencias nuevas/);
    expect(report).toContain('typescript:S1854');
    expect(report).toContain('packages/engine/src/core/loop.ts:42');
    expect(report).toContain('Remove this useless assignment to variable "x".');
    expect(report).toContain(
      'https://sonarcloud.io/project/issues?id=7daysofrain_mood-table-v2&pullRequest=12&open=AX1',
    );
    // Sin línea (incidencia de fichero): solo la ruta, sin «:undefined».
    expect(report).toContain('tooling/ci/sonar-issues.ts');
    expect(report).not.toContain('undefined');
  });

  it('avisa de las que no se listan si hay más que las devueltas en la página', () => {
    const response: IssuesSearchResponse = {
      paging: { total: 3 },
      issues: [
        {
          key: 'AX1',
          rule: 'typescript:S1',
          severity: 'MAJOR',
          component: 'p:a.ts',
          line: 1,
          message: 'm',
        },
      ],
    };
    const result = summarizeIssues(response, PR);
    expect(result.passed).toBe(false);
    expect(result.lines.join('\n')).toMatch(/2 más/);
  });
});

describe('líneas seguras para el log', () => {
  it('no deja que un dato de SonarQube abra una línea nueva en el log', () => {
    const line = toLogLine('packages/a.ts\n::error::inyectado\r\nfin');
    expect(line).not.toMatch(/[\r\n]/);
    expect(line).toBe('packages/a.ts ::error::inyectado fin');
  });

  it('sustituye cualquier carácter de control', () => {
    expect(toLogLine('a\u0000b\u001bc\u007fd\te')).toBe('a b c d e');
  });

  it('deja igual una línea normal', () => {
    expect(toLogLine('- typescript:S1854 · a.ts:42 · Remove this «x».')).toBe(
      '- typescript:S1854 · a.ts:42 · Remove this «x».',
    );
  });
});

describe('informe sin comandos del runner', () => {
  it('desactiva los comandos alrededor del informe y los reactiva al final con el mismo token', () => {
    const output = withoutRunnerCommands(['- a.ts ##[error]falso', '- b.ts'], 'tok-123');
    expect(output.split('\n')).toEqual([
      '::stop-commands::tok-123',
      '- a.ts ##[error]falso',
      '- b.ts',
      '::tok-123::',
    ]);
  });

  it('limpia cada línea, para que nada pueda colar la línea que reactiva los comandos', () => {
    const output = withoutRunnerCommands(['a\n::tok-123::\nb'], 'tok-123');
    expect(output.split('\n')).toHaveLength(3);
  });
});

/** Una incidencia de `api/issues/search` con lo mínimo; cada test cambia lo que mira. */
function issue(overrides: Partial<SonarIssue> = {}): SonarIssue {
  return {
    key: 'AX1',
    rule: 'typescript:S3358',
    severity: 'MAJOR',
    impacts: [{ softwareQuality: 'MAINTAINABILITY', severity: 'MEDIUM' }],
    component: '7daysofrain_mood-table-v2:packages/engine/src/core/loop.ts',
    line: 42,
    message: 'Extract this nested ternary operation into an independent statement.',
    ...overrides,
  };
}

const RULES = [{ key: 'typescript:S3358', name: 'Ternary operators should not be nested' }];

describe('anotaciones de las incidencias', () => {
  it('anota una incidencia en su línea, con regla, severidad, nombre de la regla y mensaje', () => {
    const annotations = toAnnotations({ paging: { total: 1 }, issues: [issue()], rules: RULES });
    expect(annotations[0]).toBe(
      '::error file=packages/engine/src/core/loop.ts,line=42,' +
        'title=typescript%3AS3358 · MEDIUM · Ternary operators should not be nested' +
        '::Extract this nested ternary operation into an independent statement.',
    );
  });

  it('anota una incidencia de fichero sin línea', () => {
    const [annotation] = toAnnotations({
      paging: { total: 1 },
      issues: [issue({ line: undefined })],
      rules: RULES,
    });
    expect(annotation).toMatch(/^::error file=packages\/engine\/src\/core\/loop\.ts,title=/);
    expect(annotation).not.toContain('line=');
  });

  it('pone la clave de la regla si la respuesta no trae su nombre', () => {
    const [annotation] = toAnnotations({ paging: { total: 1 }, issues: [issue()] });
    expect(annotation).toContain('title=typescript%3AS3358 · MEDIUM · typescript%3AS3358::');
  });

  it('avisa del total aunque quepan todas', () => {
    const annotations = toAnnotations({
      paging: { total: 2 },
      issues: [issue({ key: 'A' }), issue({ key: 'B', line: 7 })],
      rules: RULES,
    });
    expect(annotations).toHaveLength(3);
    expect(annotations.filter((line) => line.startsWith('::error '))).toHaveLength(2);
    expect(annotations[2]).toBe(
      '::notice title=Incidencias nuevas de SonarQube::2 incidencias nuevas; se anotan 2',
    );
  });

  it('anota como mucho 10, en el orden de SonarQube, y el aviso dice cuántas hay', () => {
    const issues = Array.from({ length: 12 }, (_, index) =>
      issue({ key: `A${index}`, line: index + 1 }),
    );
    const annotations = toAnnotations({ paging: { total: 12 }, issues, rules: RULES });
    const errors = annotations.filter((line) => line.startsWith('::error '));
    expect(errors).toHaveLength(10);
    expect(errors.map((line) => /line=(\d+)/.exec(line)?.[1])).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    );
    expect(annotations.at(-1)).toBe(
      '::notice title=Incidencias nuevas de SonarQube::12 incidencias nuevas; se anotan 10',
    );
  });

  it('cuenta en el aviso las que no trae la página', () => {
    const annotations = toAnnotations({ paging: { total: 150 }, issues: [issue()], rules: RULES });
    expect(annotations.at(-1)).toMatch(/::150 incidencias nuevas; se anotan 1$/);
  });

  it('no anota nada si no hay incidencias', () => {
    expect(toAnnotations({ paging: { total: 0 }, issues: [] })).toEqual([]);
  });
});

describe('severidad de una incidencia', () => {
  it('es la más alta de sus impactos', () => {
    expect(
      issueSeverity(
        issue({
          impacts: [
            { softwareQuality: 'MAINTAINABILITY', severity: 'LOW' },
            { softwareQuality: 'RELIABILITY', severity: 'BLOCKER' },
            { softwareQuality: 'SECURITY', severity: 'HIGH' },
          ],
        }),
      ),
    ).toBe('BLOCKER');
  });

  it.each([
    ['BLOCKER', 'BLOCKER'],
    ['CRITICAL', 'HIGH'],
    ['MAJOR', 'MEDIUM'],
    ['MINOR', 'LOW'],
    ['INFO', 'INFO'],
  ])('sin impactos, traduce la heredada %s a %s', (legacy, expected) => {
    expect(issueSeverity(issue({ severity: legacy, impacts: undefined }))).toBe(expected);
    expect(issueSeverity(issue({ severity: legacy, impacts: [] }))).toBe(expected);
  });
});

describe('anotaciones sin comandos inyectados', () => {
  it('escapa %, retorno y salto de línea en el mensaje', () => {
    const [annotation] = toAnnotations({
      paging: { total: 1 },
      issues: [issue({ message: '100% malo\r\n::stop-commands::x\nfin' })],
      rules: RULES,
    });
    expect(annotation).toMatch(/::100%25 malo%0D%0A::stop-commands::x%0Afin$/);
    expect(annotation).not.toMatch(/[\r\n]/);
  });

  it('escapa además : y , en el fichero y el título', () => {
    const [annotation] = toAnnotations({
      paging: { total: 1 },
      issues: [issue({ component: 'p:src/a,b:c%d\n::stop-commands::x.ts' })],
      rules: [{ key: 'typescript:S3358', name: 'Nombre, con: signos\n%' }],
    });
    expect(annotation).toContain('file=src/a%2Cb%3Ac%25d%0A%3A%3Astop-commands%3A%3Ax.ts,line=42,');
    expect(annotation).toContain('title=typescript%3AS3358 · MEDIUM · Nombre%2C con%3A signos%0A%25::');
    expect(annotation).not.toMatch(/[\r\n]/);
  });

  it('cada anotación es una sola línea aunque todo traiga saltos de línea', () => {
    const annotations = toAnnotations({
      paging: { total: 1 },
      issues: [issue({ component: 'p:a\nb.ts', message: 'x\ny' })],
      rules: [{ key: 'typescript:S3358', name: 'n\nm' }],
    });
    expect(annotations).toHaveLength(2);
    for (const annotation of annotations) expect(annotation).not.toMatch(/[\r\n]/);
  });
});
