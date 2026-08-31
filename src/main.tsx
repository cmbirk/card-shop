import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import './ui/ui.css';
import { useNavStore } from './stores/navStore';
import { useInspectStore } from './stores/inspectStore';
import { useBasketStore } from './stores/basketStore';
import { useUIStore } from './stores/uiStore';
import { useAuthStore } from './stores/authStore';
import { useDialogueStore } from './stores/dialogueStore';
import { useShopkeeperStore } from './stores/shopkeeperStore';
import { useMayaStore } from './stores/mayaStore';
import { useBinStore } from './stores/binStore';
import { reloadInventory, inventoryById } from './systems/inventory';

if (import.meta.env.DEV) {
  // dev-only hooks for scripted smoke tests
  Object.assign(window, { __nav: useNavStore, __inspect: useInspectStore, __basket: useBasketStore, __ui: useUIStore, __auth: useAuthStore, __dialogue: useDialogueStore, __keeper: useShopkeeperStore, __maya: useMayaStore, __bin: useBinStore, __reload: reloadInventory, __inventory: inventoryById });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Vercel Web Analytics — mounted beside App (not inside) so the page view counts even while #boot is up */}
    <Analytics />
  </StrictMode>,
);
