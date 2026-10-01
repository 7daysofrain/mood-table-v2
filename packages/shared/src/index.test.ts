import { describe, expect, it } from 'vitest';

import { SHARED_PACKAGE_NAME } from './index.ts';

describe('@moodtable/shared', () => {
  it('publica su nombre desde el punto de entrada', () => {
    expect(SHARED_PACKAGE_NAME).toBe('@moodtable/shared');
  });
});
