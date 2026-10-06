import { describe, expect, it } from 'vitest';

import { ADAPTERS_NAME } from './index.ts';

describe('adaptadores del motor', () => {
  it('dependen del núcleo', () => {
    expect(ADAPTERS_NAME).toBe('adapters → core');
  });
});
