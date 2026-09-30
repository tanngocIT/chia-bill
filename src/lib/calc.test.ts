import { describe, expect, it } from 'vitest';
import { calcBill, summarize } from './calc';
import { vnd } from './format';
import { qrMatrix } from './qr';
import { sampleParty } from './sample';
import { vietqrPayload } from './vietqr';

describe('calcBill', () => {
  const p = sampleParty();
  const ids = p.members.map((m) => m.id);

  it('full sponsorship puts the whole bill on the sponsor', () => {
    const c = calcBill(p.bills[0], ids);
    expect(c.total.m1).toBe(1850000);
    expect(c.total.m2).toBe(0);
  });

  it('partial sponsorship splits the remainder', () => {
    const c = calcBill(p.bills[1], ids);
    expect(c.total.m1).toBe(640000);
    expect(c.total.m2).toBe(140000);
  });

  it('rounds to 1.000đ and gives the difference to the payer', () => {
    const c = calcBill(p.bills[2], ids);
    expect(c.total.m2).toBe(117000);
    expect(c.total.m5).toBe(116000);
    expect(Object.values(c.total).reduce((a, b) => a + b, 0)).toBe(350000);
  });

  it('validates custom split sums', () => {
    const b = { ...p.bills[2], split: 'amount' as const, custom: { m2: 100000, m4: 100000, m5: 100000 } };
    const c = calcBill(b, ids);
    expect(c.ok).toBe(false);
    expect(c.remaining).toBe(50000);
  });
});

describe('sponsor-only members', () => {
  // 3 people, bill 1 = 2M, bill 2 = 4M, P1 sponsors 1M of bill 1 and opts out
  // of the rest → P2 and P3 each pay (2 + 4 − 1) / 2 = 2.5M, P1 pays 1M.
  const party = {
    ...sampleParty(),
    members: [
      { id: 'p1', name: 'A', color: '#000', sponsorOnly: true },
      { id: 'p2', name: 'B', color: '#000' },
      { id: 'p3', name: 'C', color: '#000' },
    ],
    bills: [
      { id: 'x1', name: 'Bill 1', amount: 2000000, payer: 'p2', parts: ['p1', 'p2', 'p3'], split: 'equal' as const, custom: {}, sponsorOn: true, sponsors: ['p1'], sponsorType: 'fixed' as const, sponsorAmount: 1000000, note: '', photo: null },
      { id: 'x2', name: 'Bill 2', amount: 4000000, payer: 'p3', parts: ['p1', 'p2', 'p3'], split: 'equal' as const, custom: {}, sponsorOn: false, sponsors: [], sponsorType: 'full' as const, sponsorAmount: 0, note: '', photo: null },
    ],
  };

  it('leaves the sponsor out of every remainder split', () => {
    const s = summarize(party);
    expect(s.owed).toEqual({ p1: 1000000, p2: 2500000, p3: 2500000 });
    expect(s.calcs.x2.excluded).toEqual(['p1']);
  });

  it('includes the sponsor again when the flag is off', () => {
    const s = summarize({ ...party, members: party.members.map((m) => ({ ...m, sponsorOnly: false })) });
    expect(s.owed.p1).toBe(1000000 + 333000 + 1333000);
  });

  it('needs someone to share the remainder', () => {
    const c = calcBill({ ...party.bills[1], parts: ['p1'] }, ['p1', 'p2', 'p3'], ['p1']);
    expect(c.ok).toBe(false);
  });
});

describe('summarize', () => {
  it('hub mode routes everything through the organiser', () => {
    const s = summarize(sampleParty());
    expect(s.txs.map((t) => `${t.from}>${t.to}:${vnd(t.amt)}`)).toEqual([
      'm1>m3:2.490.000đ',
      'm2>m3:257.000đ',
      'm3>m4:943.000đ',
      'm3>m5:94.000đ',
    ]);
  });

  it('min mode simplifies debts', () => {
    const s = summarize({ ...sampleParty(), settleMode: 'min' });
    expect(s.txs).toHaveLength(4);
    const sum = Object.values(s.net).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });
});

describe('qr / vietqr', () => {
  it('builds a valid VietQR payload with CRC', () => {
    expect(vietqrPayload('970436', '0123456789', 1710000, 'Tuan tra Minh')).toBe(
      '00020101021238540010A00000072701240006970436011001234567890208QRIBFTTA5303704540717100005802VN62170813Tuan tra Minh63045F5A',
    );
  });
  it('encodes a matrix of the right size', () => {
    expect(qrMatrix('https://example.com')?.length).toBe(25);
  });
});
