import { randomId } from '../lib/format';
import type { PaidMap, Party } from '../lib/types';
import type { Snapshot, Store, Watcher } from './store';

/**
 * Cloudflare D1 backend. Talks to the Pages Function in functions/api/ over
 * same-origin fetch. No realtime channel: viewers poll and refresh when the
 * tab becomes visible again.
 */
export function d1Store(base = '/api'): Store {
  async function call<T>(path: string, init: RequestInit & { key?: string } = {}): Promise<{ status: number; body: T }> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (init.key) headers['x-edit-key'] = init.key;
    let res: Response;
    try {
      res = await fetch(base + path, { ...init, headers });
    } catch {
      throw new Error('Lỗi kết nối máy chủ');
    }
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok && res.status !== 404) throw new Error(body.error || 'Lỗi kết nối máy chủ');
    return { status: res.status, body };
  }

  return {
    kind: 'd1',
    async create(party) {
      const id = randomId(10);
      const key = randomId(16);
      await call('/parties', { method: 'POST', key, body: JSON.stringify({ id, party }) });
      return { id, key };
    },
    async load(id): Promise<Snapshot | null> {
      const { status, body } = await call<{ party: Party; paid: PaidMap }>(`/parties/${id}`);
      if (status === 404 || !body.party) return null;
      return { party: body.party, paid: body.paid || {} };
    },
    async save(id, key, party) {
      await call(`/parties/${id}`, { method: 'PUT', key, body: JSON.stringify({ party }) });
    },
    async setPaid(id, txKey, paid) {
      await call(`/parties/${id}/paid`, { method: 'POST', body: JSON.stringify({ tx: txKey, paid }) });
    },
    async remove(id, key) {
      await call(`/parties/${id}`, { method: 'DELETE', key });
    },
    watch(_id, onChange): Watcher {
      const visible = () => document.visibilityState === 'visible' && onChange();
      const t = window.setInterval(visible, 10000);
      document.addEventListener('visibilitychange', visible);
      return {
        stop: () => {
          window.clearInterval(t);
          document.removeEventListener('visibilitychange', visible);
        },
        ping: () => {},
      };
    },
    viewRoute(id) {
      return `/p/${id}`;
    },
  };
}
