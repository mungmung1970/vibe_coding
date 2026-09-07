import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './features/auth/AuthContext.jsx';
import App from './App.jsx';
import './styles/index.css';

createRoot(document.querySelector('#app')).render(
  <StrictMode><AuthProvider><App /></AuthProvider></StrictMode>,
);
