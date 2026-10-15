import { describe, expect, it } from 'vitest';

import { createFrameLoop } from '../core/frame-loop.ts';
import { MemoryOutput } from './memory-output.ts';

describe('la salida en memoria', () => {
  it('tras dos pulsos con colores distintos, guarda dos frames distintos', () => {
    const output = new MemoryOutput();
    const config = { id: 'demo', name: 'demo', output: { type: 'virtual' as const }, ledCount: 60 };
    const loop = createFrameLoop([{ config, outputs: [output] }], 60);

    loop.tick(0);
    loop.tick(1000);

    expect(output.frames.map((frame) => frame.seq)).toEqual([0, 60]);
    expect(output.frames[0]?.colors).not.toEqual(output.frames[1]?.colors);
  });
});
