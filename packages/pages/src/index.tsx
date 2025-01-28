import React from 'react';
import './index.css';
// This is needed for testing React 16 and 17.
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';

import App from './App.tsx';

const rootElement = document.getElementById('root');

// rootElement && createRoot(rootElement).render(<App />);

async function enableMocking(): Promise<unknown> {
  if (!IS_PRODUCTION) {
    const { worker } = await import('./mocks/browser.ts');

    return worker.start();
  }

  return;
}

declare const IS_PRODUCTION: boolean;

IS_PRODUCTION || new EventSource('/esbuild').addEventListener('change', () => location.reload());

enableMocking().then(() => render(<App />, rootElement));
