import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@usp/ui-web/styles.css';
import './app/shell.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
