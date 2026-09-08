import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkbenchProvider } from './state/WorkbenchContext.jsx';
import App from './App.jsx';
import './styles/index.css';

createRoot(document.querySelector('#app')).render(
  <StrictMode>
    <WorkbenchProvider>
      <App />
    </WorkbenchProvider>
  </StrictMode>,
);
