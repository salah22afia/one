import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@usp/ui-web/styles.css';
import './app/shell.css';
import { App } from './app/App';
import { applyDisplay, cachedPreferences } from './app/preferences';

// This device's last known appearance and text size, before the first paint (the server's copy follows at sign-in).
const cached = cachedPreferences();
if (cached) applyDisplay(cached);

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
