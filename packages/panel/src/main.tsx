import '@mantine/core/styles.css';

import { MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { colorScheme, theme } from './theme.ts';

const root = document.getElementById('root');
if (!root) {
  throw new Error('No se encuentra el elemento #root en index.html');
}

createRoot(root).render(
  <StrictMode>
    <MantineProvider theme={theme} forceColorScheme={colorScheme}>
      <App />
    </MantineProvider>
  </StrictMode>,
);
