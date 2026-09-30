import type { PaidMap, Party } from '../lib/types';

export interface Snapshot {
  party: Party;
  paid: PaidMap;
}

export interface Watcher {
  stop(): void;
  /** tell other viewers something changed */
  ping(): void;
}

/**
 * Storage backend. Two implementations:
 * - LocalStore: no server. Party lives in this browser; the share link carries
 *   the data itself (compressed in the URL). "Đã trả" marks stay per device.
 * - SupabaseStore: party + payment status in Postgres, synced across devices.
 */
export interface Store {
  kind: 'local' | 'supabase';
  create(party: Party): Promise<{ id: string; key: string }>;
  load(id: string): Promise<Snapshot | null>;
  save(id: string, key: string, party: Party): Promise<void>;
  setPaid(id: string, txKey: string, paid: boolean): Promise<void>;
  remove(id: string, key: string): Promise<void>;
  watch(id: string, onChange: () => void): Watcher;
  /** hash route (without "#") that opens the read-only view */
  viewRoute(id: string, party: Party): string;
}

/** Parties this browser created or opened as organiser */
export interface MyParty {
  id: string;
  key: string;
  name: string;
  date: string;
  kind: 'local' | 'supabase';
  updatedAt: number;
}

const MINE = 'chiabill:mine';

export function listMine(): MyParty[] {
  try {
    return (JSON.parse(localStorage.getItem(MINE) || '[]') as MyParty[]).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function rememberMine(p: MyParty) {
  try {
    const all = listMine().filter((x) => x.id !== p.id);
    all.unshift(p);
    localStorage.setItem(MINE, JSON.stringify(all.slice(0, 50)));
  } catch {
    /* storage full or blocked */
  }
}

export function forgetMine(id: string) {
  try {
    localStorage.setItem(MINE, JSON.stringify(listMine().filter((x) => x.id !== id)));
  } catch {
    /* ignore */
  }
}
