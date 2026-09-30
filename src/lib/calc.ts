import { r1k, vnd } from './format';
import type { Bill, Member, Party, Tx } from './types';

export interface BillCalc {
  /** participants who actually share the remainder (sponsor-only members removed) */
  parts: string[];
  /** participants left out because they are sponsor-only */
  excluded: string[];
  sps: string[];
  /** sponsorship per member */
  sp: Record<string, number>;
  /** participant share per member (after sponsorship) */
  sh: Record<string, number>;
  /** sp + sh for everyone involved */
  total: Record<string, number>;
  /** amount left to split after sponsorship */
  rem: number;
  spTotal: number;
  /** custom split: VND or % still unassigned (negative = over) */
  remaining: number;
  errs: string[];
  ok: boolean;
}

/**
 * Split one bill.
 * - Sponsorship is taken off first (full = sponsors split the whole bill,
 *   fixed = each sponsor covers `sponsorAmount`).
 * - The remainder is split among participants (equal / amount / percent).
 * - Equal and percent shares are rounded to 1.000đ; the rounding difference
 *   goes to the payer (or the first participant if the payer did not join).
 * - Members in `sponsorOnly` never share the remainder: they pay only what
 *   they sponsor.
 */
export function calcBill(b: Bill, ids: string[], sponsorOnly: string[] = []): BillCalc {
  const joined = b.parts.filter((id) => ids.includes(id));
  const parts = joined.filter((id) => !sponsorOnly.includes(id));
  const excluded = joined.filter((id) => sponsorOnly.includes(id));
  const sps = b.sponsorOn ? b.sponsors.filter((id) => ids.includes(id)) : [];
  const amt = b.amount || 0;
  const sp: Record<string, number> = {};
  const sh: Record<string, number> = {};
  const errs: string[] = [];
  let spTotal = 0;

  if (sps.length && amt > 0) {
    if (b.sponsorType === 'full') {
      const each = r1k(amt / sps.length);
      sps.forEach((id) => (sp[id] = each));
      sp[sps[0]] += amt - each * sps.length;
      spTotal = amt;
    } else {
      let left = amt;
      const per = b.sponsorAmount || 0;
      sps.forEach((id) => {
        const v = Math.min(per, left);
        sp[id] = v;
        left -= v;
      });
      spTotal = amt - left;
      if (!(per > 0)) errs.push('Nhập số tiền tài trợ.');
      else if (per * sps.length > amt) errs.push('Tiền tài trợ đang vượt quá số tiền hóa đơn.');
    }
  } else if (b.sponsorOn && !sps.length) {
    errs.push('Chọn ít nhất 1 người tài trợ.');
  }

  const rem = amt - spTotal;
  let sum = 0;
  parts.forEach((id) => (sh[id] = 0));
  const sink = b.payer && parts.includes(b.payer) ? b.payer : parts[0];

  if (parts.length && rem > 0) {
    if (b.split === 'equal') {
      const each = r1k(rem / parts.length);
      parts.forEach((id) => (sh[id] = each));
      sh[sink] += rem - each * parts.length;
    } else if (b.split === 'amount') {
      parts.forEach((id) => {
        const v = b.custom[id] || 0;
        sh[id] = v;
        sum += v;
      });
    } else {
      parts.forEach((id) => {
        const p = b.custom[id] || 0;
        sum += p;
        sh[id] = r1k((rem * p) / 100);
      });
      if (sum === 100) {
        const tot = parts.reduce((a, id) => a + sh[id], 0);
        sh[sink] += rem - tot;
      }
    }
  }

  const remaining = b.split === 'amount' ? rem - sum : 100 - sum;
  if (!(amt > 0)) errs.unshift('Nhập số tiền lớn hơn 0.');
  if (!joined.length) errs.push('Chọn ít nhất 1 người tham gia.');
  else if (!parts.length && rem > 0) errs.push('Cần ít nhất 1 người chia phần còn lại (không tính người chỉ tài trợ).');
  if (parts.length && rem > 0 && b.split !== 'equal' && remaining !== 0) {
    errs.push(b.split === 'amount' ? `Tổng các phần phải bằng ${vnd(rem)}.` : 'Tổng phần trăm phải bằng 100%.');
  }

  const total: Record<string, number> = {};
  ids.forEach((id) => {
    if (parts.includes(id) || sps.includes(id)) total[id] = (sp[id] || 0) + (sh[id] || 0);
  });
  return { parts, excluded, sps, sp, sh, total, rem, spTotal, remaining, errs, ok: errs.length === 0 };
}

/** Everyone settles through the organiser (collect, then pay back). */
export function settleHub(members: Member[], net: Record<string, number>, org: string): Tx[] {
  const tx: Tx[] = [];
  members.forEach((m) => {
    if (m.id !== org && net[m.id] < 0) tx.push({ from: m.id, to: org, amt: -net[m.id] });
  });
  members.forEach((m) => {
    if (m.id !== org && net[m.id] > 0) tx.push({ from: org, to: m.id, amt: net[m.id] });
  });
  return tx;
}

/** Greedy debt simplification: few transfers, largest first. */
export function settleMin(members: Member[], net: Record<string, number>): Tx[] {
  const cr = members.filter((m) => net[m.id] > 0).map((m) => ({ id: m.id, v: net[m.id] })).sort((a, b) => b.v - a.v);
  const db = members.filter((m) => net[m.id] < 0).map((m) => ({ id: m.id, v: -net[m.id] })).sort((a, b) => b.v - a.v);
  const tx: Tx[] = [];
  let i = 0;
  let j = 0;
  while (i < db.length && j < cr.length) {
    const a = Math.min(db[i].v, cr[j].v);
    if (a > 0) tx.push({ from: db[i].id, to: cr[j].id, amt: a });
    db[i].v -= a;
    cr[j].v -= a;
    if (db[i].v === 0) i++;
    if (cr[j].v === 0) j++;
  }
  return tx;
}

export interface Summary {
  ids: string[];
  calcs: Record<string, BillCalc>;
  owed: Record<string, number>;
  paidUp: Record<string, number>;
  net: Record<string, number>;
  grand: number;
  org: string | null;
  hub: boolean;
  txs: Tx[];
}

export function summarize(p: Party): Summary {
  const ids = p.members.map((m) => m.id);
  const calcs: Record<string, BillCalc> = {};
  const owed: Record<string, number> = {};
  const paidUp: Record<string, number> = {};
  const net: Record<string, number> = {};
  ids.forEach((id) => {
    owed[id] = 0;
    paidUp[id] = 0;
  });
  const only = sponsorOnlyIds(p);
  p.bills.forEach((b) => {
    const c = calcBill(b, ids, only);
    calcs[b.id] = c;
    Object.keys(c.total).forEach((id) => (owed[id] += c.total[id]));
    if (b.payer && ids.includes(b.payer)) paidUp[b.payer] += b.amount;
  });
  ids.forEach((id) => (net[id] = paidUp[id] - owed[id]));
  const grand = p.bills.reduce((a, b) => a + (b.amount || 0), 0);
  const org = p.organiser && ids.includes(p.organiser) ? p.organiser : ids[0] || null;
  const hub = p.settleMode !== 'min' && !!org;
  const txs = hub && org ? settleHub(p.members, net, org) : settleMin(p.members, net);
  return { ids, calcs, owed, paidUp, net, grand, org, hub, txs };
}

export const txKey = (t: Tx) => `${t.from}>${t.to}`;

export const sponsorOnlyIds = (p: Party) => p.members.filter((m) => m.sponsorOnly).map((m) => m.id);
