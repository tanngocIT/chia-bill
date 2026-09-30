import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { randomId } from '../lib/format';
import type { PaidMap, Party } from '../lib/types';
import type { Snapshot, Store, Watcher } from './store';

interface GetPartyResult {
  data: Party;
  paid: PaidMap | null;
  updated_at: string;
}

/**
 * Supabase backend. All access goes through SECURITY DEFINER functions
 * (see supabase/schema.sql): tables have RLS on and no policies, so the
 * public anon key can only call get_party / create_party / update_party /
 * set_paid / delete_party. Editing needs the organiser's secret key.
 */
export function supabaseStore(url: string, anonKey: string): Store {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: false } });

  const fail = (e: { message?: string } | null) => {
    if (e) throw new Error(e.message || 'Lỗi kết nối máy chủ');
  };

  return {
    kind: 'supabase',
    async create(party) {
      const id = randomId(10);
      const key = randomId(16);
      const { error } = await sb.rpc('create_party', { p_id: id, p_key: key, p_data: party });
      fail(error);
      return { id, key };
    },
    async load(id): Promise<Snapshot | null> {
      const { data, error } = await sb.rpc('get_party', { p_id: id });
      fail(error);
      const r = data as GetPartyResult | null;
      if (!r || !r.data) return null;
      return { party: r.data, paid: r.paid || {} };
    },
    async save(id, key, party) {
      const { error } = await sb.rpc('update_party', { p_id: id, p_key: key, p_data: party });
      fail(error);
    },
    async setPaid(id, txKey, paid) {
      const { error } = await sb.rpc('set_paid', { p_id: id, p_tx: txKey, p_paid: paid });
      fail(error);
    },
    async remove(id, key) {
      const { error } = await sb.rpc('delete_party', { p_id: id, p_key: key });
      fail(error);
    },
    watch(id, onChange): Watcher {
      // Broadcast channel: no table access needed, works with RLS locked down.
      const ch: RealtimeChannel = sb.channel(`party-${id}`, { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'changed' }, () => onChange()).subscribe();
      // Fallback polling + refresh when the tab comes back.
      const t = window.setInterval(onChange, 30000);
      const vis = () => document.visibilityState === 'visible' && onChange();
      document.addEventListener('visibilitychange', vis);
      return {
        stop: () => {
          window.clearInterval(t);
          document.removeEventListener('visibilitychange', vis);
          sb.removeChannel(ch);
        },
        ping: () => {
          ch.send({ type: 'broadcast', event: 'changed', payload: {} });
        },
      };
    },
    viewRoute(id) {
      return `/p/${id}`;
    },
  };
}
