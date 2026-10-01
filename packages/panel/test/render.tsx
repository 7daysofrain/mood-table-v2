import { MantineProvider } from '@mantine/core';
import { render as testingLibraryRender } from '@testing-library/react';
import type { ReactNode } from 'react';

import { colorScheme, theme } from '../src/theme.ts';

/** `render` de Testing Library con el mismo `MantineProvider` que monta `main.tsx`. */
export function render(ui: ReactNode) {
  return testingLibraryRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MantineProvider theme={theme} forceColorScheme={colorScheme} env="test">
        {children}
      </MantineProvider>
    ),
  });
}
