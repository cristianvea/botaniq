import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// En la demo publicada no hay diálogos del navegador: confirmamos directamente
if (import.meta.env.VITE_DEMO) window.confirm = () => true;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
