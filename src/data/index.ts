import { d1Store } from './d1';
import { localStore } from './local';
import type { Store } from './store';
import { supabaseStore } from './supabase';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * VITE_STORE=d1 -> Cloudflare D1 via the Pages Function in functions/api/.
 * Otherwise Supabase when its vars are set, else browser-only storage.
 */
export const store: Store =
  import.meta.env.VITE_STORE === 'd1' ? d1Store() : url && key ? supabaseStore(url, key) : localStore;

/** Absolute URL for a hash route, e.g. "/p/abc" -> https://me.github.io/chia-bill/#/p/abc */
export function absoluteUrl(route: string): string {
  const base = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || window.location.href.split('#')[0];
  return base.replace(/\/?$/, '/').replace(/\/index\.html\/$/, '/') + '#' + route;
}

export * from './store';
