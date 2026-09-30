import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/ui';
import './styles.css';

try {
  const t = localStorage.getItem('chiabill:theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch {
  /* ignore */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
