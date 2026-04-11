import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './ui/App';
import './index.css';
import 'katex/dist/katex.min.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Expected #root element in index.html');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
