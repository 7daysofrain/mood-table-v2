import { describe, expect, it } from 'vitest';

import { formatDuration } from './format-duration.ts';

describe('formatDuration', () => {
  it('da minutos y segundos, con dos cifras en los segundos', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(0)).toBe('0:00');
  });
});
