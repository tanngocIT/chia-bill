import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { randomId } from '../lib/format';
import type { PaidMap, Party } from '../lib/types';
import type { Snapshot, Store, Watcher } from './store';

const K = (id: string) => `chiabill:party:${id}`;
const P = (id: string) => `chiabill:paid:${id}`;

interface Saved {
  party: Party;
  key: string;
}

function read(id: string): Saved | null {
  try {
    const s = localStorage.getItem(K(id));
    return s ? (JSON.parse(s) as Saved) : null;
  } catch {
    return null;
  }
}

function readPaid(id: string): PaidMap {
  try {
    return JSON.parse(localStorage.getItem(P(id)) || '{}') as PaidMap;
  } catch {
    return {};
  }
}

/**
 * Party data for a share link: images are dropped so the link stays short
 * enough for Zalo / Messenger. Receivers with bank details still get an
 * auto-generated VietQR.
 */
export function encodeShare(id: string, party: Party): string {
  const slim: Party = {
    ...party,
    bills: party.bills.map((b) => ({ ...b, photo: null })),
    bank: Object.fromEntries(Object.entries(party.bank).map(([k, v]) => [k, { ...v, qr: null }])),
  };
  return compressToEncodedURIComponent(JSON.stringify({ id, p: slim }));
}

export function decodeShare(data: string): { id: string; party: Party } | null {
  try {
    const raw = decompressFromEncodedURIComponent(data);
    if (!raw) return null;
    const o = JSON.parse(raw) as { id: string; p: Party };
    if (!o || !o.p || !Array.isArray(o.p.members)) return null;
    return { id: o.id, party: o.p };
  } catch {
    return null;
  }
}

export function localPaid(id: string): PaidMap {
  return readPaid(id);
}

export function setLocalPaid(id: string, txKey: string, paid: boolean) {
  const m = readPaid(id);
  m[txKey] = paid;
  try {
    localStorage.setItem(P(id), JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export const localStore: Store = {
  kind: 'local',
  async create(party) {
    const id = randomId(8);
    const key = randomId(12);
    localStorage.setItem(K(id), JSON.stringify({ party, key } satisfies Saved));
    return { id, key };
  },
  async load(id): Promise<Snapshot | null> {
    const s = read(id);
    return s ? { party: s.party, paid: readPaid(id) } : null;
  },
  async save(id, key, party) {
    const s = read(id);
    if (s && s.key !== key) throw new Error('Sai mã quản lý');
    try {
      localStorage.setItem(K(id), JSON.stringify({ party, key } satisfies Saved));
    } catch {
      throw new Error('Bộ nhớ trình duyệt đã đầy. Hãy xóa bớt ảnh.');
    }
  },
  async setPaid(id, txKey, paid) {
    setLocalPaid(id, txKey, paid);
  },
  async remove(id) {
    localStorage.removeItem(K(id));
    localStorage.removeItem(P(id));
  },
  watch(id, onChange): Watcher {
    const h = (e: StorageEvent) => {
      if (e.key === K(id) || e.key === P(id)) onChange();
    };
    window.addEventListener('storage', h);
    return { stop: () => window.removeEventListener('storage', h), ping: () => {} };
  },
  viewRoute(id, party) {
    return `/v/${encodeShare(id, party)}`;
  },
};
