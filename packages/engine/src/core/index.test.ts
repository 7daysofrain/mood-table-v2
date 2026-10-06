import { describe, expect, it } from 'vitest';

import { CORE_NAME } from './index.ts';

describe('núcleo del motor', () => {
  it('se puede importar', () => {
    expect(CORE_NAME).toBe('core');
  });
});
