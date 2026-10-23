import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// En la demo publicada no hay diálogos del navegador: confirmamos directamente
if (import.meta.env.VITE_DEMO) window.confirm = () => true;

// Versión nueva publicada: el service worker se activa y recargamos una vez para usarla
if ('serviceWorker' in navigator && !import.meta.env.VITE_DEMO) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  // Al volver a la app, comprobamos si hay versión nueva
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
