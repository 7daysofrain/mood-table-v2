/**
 * Parte pura de la comprobación de incidencias nuevas de SonarQube (specs/quality-gates, design.md
 * decisión 3): leer el informe del escáner, decidir qué hacer con el estado del análisis y convertir
 * la respuesta de `api/issues/search` en el resultado de la comprobación.
 */
import { describe, expect, it } from 'vitest';

import {
  type IssuesSearchResponse,
  nextStepForCeTask,
  parseCeTaskUrl,
  summarizeIssues,
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
  it('devuelve la URL de la tarea de análisis', () => {
    expect(parseCeTaskUrl(REPORT_TASK)).toBe('https://sonarcloud.io/api/ce/task?id=AZm1');
  });

  it('falla con un mensaje claro si el informe no trae la URL', () => {
    expect(() => parseCeTaskUrl('projectKey=x\nserverUrl=https://sonarcloud.io\n')).toThrow(
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
          component: '7daysofrain_mood-table-v2:packages/engine/src/core/loop.ts',
          line: 42,
          message: 'Remove this useless assignment to variable "x".',
        },
        {
          key: 'AX2',
          rule: 'typescript:S1128',
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
        { key: 'AX1', rule: 'typescript:S1', component: 'p:a.ts', line: 1, message: 'm' },
      ],
    };
    const result = summarizeIssues(response, PR);
    expect(result.passed).toBe(false);
    expect(result.lines.join('\n')).toMatch(/2 más/);
  });
});
