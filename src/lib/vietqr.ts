/** Banks supporting NAPAS 247 VietQR, by BIN. Extend as needed. */
export const BANKS: { bin: string; name: string }[] = [
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970422', name: 'MB Bank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970405', name: 'Agribank' },
  { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970441', name: 'VIB' },
  { bin: '970437', name: 'HDBank' },
  { bin: '970448', name: 'OCB' },
  { bin: '970443', name: 'SHB' },
  { bin: '970426', name: 'MSB' },
];

export const bankName = (bin: string) => BANKS.find((b) => b.bin === bin)?.name ?? '';

function crc16(s: string): string {
  let c = 0xffff;
  for (let i = 0; i < s.length; i++) {
    c ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) c = c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1;
    c &= 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, '0');
}

const tlv = (id: string, v: string) => id + String(v.length).padStart(2, '0') + v;

/**
 * EMVCo / NAPAS VietQR payload for a transfer to a bank account.
 * `note` should be ASCII, ≤ 25 chars for the widest bank-app support.
 */
export function vietqrPayload(bin: string, acc: string, amount?: number, note?: string): string {
  const cons = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', acc)) + tlv('02', 'QRIBFTTA');
  const s =
    tlv('00', '01') +
    tlv('01', amount ? '12' : '11') +
    tlv('38', cons) +
    tlv('53', '704') +
    (amount ? tlv('54', String(amount)) : '') +
    tlv('58', 'VN') +
    (note ? tlv('62', tlv('08', note)) : '') +
    '6304';
  return s + crc16(s);
}
