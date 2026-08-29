import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './ui/ui.css';
import { useNavStore } from './stores/navStore';
import { useInspectStore } from './stores/inspectStore';
import { useBasketStore } from './stores/basketStore';
import { useUIStore } from './stores/uiStore';
import { useAuthStore } from './stores/authStore';

if (import.meta.env.DEV) {
  // dev-only hooks for scripted smoke tests
  Object.assign(window, { __nav: useNavStore, __inspect: useInspectStore, __basket: useBasketStore, __ui: useUIStore, __auth: useAuthStore });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
