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
