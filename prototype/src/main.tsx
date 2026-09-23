import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/motion.css';
import './styles/leave.css';
import './styles/need.css';
import './styles/doc.css';
import './styles/home.css';
import './styles/designer.css';
import './styles/deeplook.css';
import './styles/admin.css';

createRoot(document.getElementById('root')!).render(<App />);
