import { useEffect, useState } from 'react';
import type { Card } from '@shared/types';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { reloadInventory } from '../systems/inventory';
import { listAllCards } from '../admin/adminCards';
import { InventoryTab } from './admin/InventoryTab';
import { ImportTab } from './admin/ImportTab';
import { UsersTab } from './admin/UsersTab';

// The back office. Admin-only: inventory CRUD (every column, incl. sold/reserved/personal and
// cost basis), bulk import/delete, and the visitors list with admin promotion. Writes go straight
// to Supabase under the admin JWT; RLS is the real gate — this UI just hides itself from non-admins.

type Tab = 'inventory' | 'import' | 'users';

export function AdminPanel() {
  const open = useUIStore((s) => s.adminOpen);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [tab, setTab] = useState<Tab>('inventory');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setCards(await listAllCards());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && isAdmin) void refresh();
  }, [open, isAdmin]);

  // Esc leaves the computer and puts you back in the office
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement | null)?.closest('textarea')) useUIStore.getState().setAdminOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open || !isAdmin) return null;

  const close = () => useUIStore.getState().setAdminOpen(false);
  const afterWrite = async () => {
    await refresh();
    await reloadInventory(); // shelves pick up the change without a page reload
  };

  return (
    <div className="modal-backdrop admin-backdrop">
      <div className="modal admin">
        <div className="admin-head">
          <div>
            <div className="signin-title">Back Office</div>
            <div className="signin-sub">
              {cards.length} cards · {cards.filter((c) => c.status === 'available').length} on the floor
            </div>
          </div>
          <div className="admin-tabs">
            {(['inventory', 'import', 'users'] as Tab[]).map((t) => (
              <button key={t} className={`admin-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t === 'inventory' ? 'Inventory' : t === 'import' ? 'Import' : 'Users'}
              </button>
            ))}
          </div>
          <div className="admin-head-actions">
            <button className="btn secondary" onClick={() => void refresh()} disabled={loading} title="Reload">
              ↻
            </button>
            <button className="btn secondary" onClick={() => void useAuthStore.getState().signOut().then(close)}>
              Sign out
            </button>
            <button className="btn admin-exit" onClick={close} title="Back to the office (Esc)">
              ← Back to the office
            </button>
          </div>
        </div>

        {error && <div className="signin-error">{error}</div>}

        {tab === 'inventory' && <InventoryTab cards={cards} loading={loading} onChanged={afterWrite} onError={setError} />}
        {tab === 'import' && <ImportTab existing={cards} onImported={afterWrite} onError={setError} />}
        {tab === 'users' && <UsersTab onError={setError} />}
      </div>
    </div>
  );
}
