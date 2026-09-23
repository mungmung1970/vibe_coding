import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';
import './styles/fonts.css';
import './styles/candidates.css';
import './styles/relationship-guide.css';
import './styles/highlight.css';
import './styles/inspector-details.css';
import './styles/panels.css';
import './styles/matching-test.css';
import './styles/node-dialog.css';
import './styles/graph-scroll.css';
import './styles/new-creation.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
