/**
 * Minimal QR code encoder: byte mode, error correction level M, mask 0.
 * Adapted from Project Nayuki's reference algorithm (MIT). Enough for links and
 * VietQR payloads (a few hundred bytes).
 */
const ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const NB = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

function rawMods(v: number): number {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const na = Math.floor(v / 7) + 2;
    r -= (25 * na - 10) * na - 55;
    if (v >= 7) r -= 36;
  }
  return r;
}
const dataCw = (v: number) => Math.floor(rawMods(v) / 8) - ECC[v] * NB[v];

function mul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

export function qrMatrix(text: string): boolean[][] | null {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  for (; ver <= 40; ver++) if (4 + (ver <= 9 ? 8 : 16) + bytes.length * 8 <= dataCw(ver) * 8) break;
  if (ver > 40) return null;

  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(4, 4);
  push(bytes.length, ver <= 9 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  const cap = dataCw(ver) * 8;
  push(0, Math.min(4, cap - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let by = 0;
    for (let j = 0; j < 8; j++) by = (by << 1) | bits[i + j];
    data.push(by);
  }

  // Reed–Solomon
  const deg = ECC[ver];
  const div: number[] = new Array(deg - 1).fill(0).concat([1]);
  let root = 1;
  for (let k = 0; k < deg; k++) {
    for (let j = 0; j < div.length; j++) {
      div[j] = mul(div[j], root);
      if (j + 1 < div.length) div[j] ^= div[j + 1];
    }
    root = mul(root, 2);
  }
  const rsRem = (d: number[]) => {
    const r = div.map(() => 0);
    d.forEach((b) => {
      const f = b ^ (r.shift() as number);
      r.push(0);
      div.forEach((c, i) => (r[i] ^= mul(c, f)));
    });
    return r;
  };
  const nb = NB[ver];
  const raw = Math.floor(rawMods(ver) / 8);
  const nShort = nb - (raw % nb);
  const shortLen = Math.floor(raw / nb);
  const blocks: number[][] = [];
  for (let bi = 0, off = 0; bi < nb; bi++) {
    const dl = shortLen - deg + (bi < nShort ? 0 : 1);
    const dat = data.slice(off, off + dl);
    off += dl;
    const ecc = rsRem(dat);
    if (bi < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const cw: number[] = [];
  for (let i = 0; i < blocks[0].length; i++)
    for (let j = 0; j < blocks.length; j++) if (i !== shortLen - deg || j >= nShort) cw.push(blocks[j][i]);

  // Modules
  const n = ver * 4 + 17;
  const M: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const F: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (x: number, y: number, d: boolean) => {
    M[y][x] = d;
    F[y][x] = true;
  };
  for (let t = 0; t < n; t++) {
    set(6, t, t % 2 === 0);
    set(t, 6, t % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const dd = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx >= 0 && xx < n && yy >= 0 && yy < n) set(xx, yy, dd !== 2 && dd !== 4);
      }
  };
  finder(3, 3);
  finder(n - 4, 3);
  finder(3, n - 4);
  let al: number[] = [];
  if (ver > 1) {
    const na = Math.floor(ver / 7) + 2;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
    al = [6];
    for (let p = n - 7; al.length < na; p -= step) al.splice(1, 0, p);
  }
  al.forEach((a, ai) =>
    al.forEach((b, aj) => {
      if ((ai === 0 && aj === 0) || (ai === 0 && aj === al.length - 1) || (ai === al.length - 1 && aj === 0)) return;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) set(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  const fmt = (mask: number) => {
    const d = (0 << 3) | mask; // ECC level M = 0b00
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const fb = ((d << 10) | r) ^ 0x5412;
    const g = (i: number) => ((fb >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, g(i));
    set(8, 7, g(6));
    set(8, 8, g(7));
    set(7, 8, g(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, g(i));
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, g(i));
    set(8, n - 8, true);
  };
  fmt(0);
  if (ver >= 7) {
    let vr = ver;
    for (let i = 0; i < 12; i++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1f25);
    const vb = (ver << 12) | vr;
    for (let i = 0; i < 18; i++) {
      const bt = ((vb >>> i) & 1) === 1;
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bt);
      set(b, a, bt);
    }
  }
  let bitI = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++)
      for (let jj = 0; jj < 2; jj++) {
        const x = right - jj;
        const up = ((right + 1) & 2) === 0;
        const y = up ? n - 1 - vert : vert;
        if (!F[y][x] && bitI < cw.length * 8) {
          M[y][x] = ((cw[bitI >>> 3] >>> (7 - (bitI & 7))) & 1) === 1;
          bitI++;
        }
      }
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!F[y][x] && (x + y) % 2 === 0) M[y][x] = !M[y][x];
  fmt(0);
  return M;
}

const cache = new Map<string, string>();

/** SVG path data for a 100×100 viewBox (4-module quiet zone included). */
export function qrPath(text: string): string {
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const M = qrMatrix(text);
  if (!M) return '';
  const n = M.length;
  const q = 4;
  const k = 100 / (n + 2 * q);
  let d = '';
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (M[y][x]) {
        let x2 = x;
        while (x2 < n && M[y][x2]) x2++;
        const w = ((x2 - x) * k).toFixed(3);
        d += `M${((x + q) * k).toFixed(3)} ${((y + q) * k).toFixed(3)}h${w}v${(k + 0.02).toFixed(3)}h-${w}z`;
        x = x2;
      } else x++;
    }
  }
  cache.set(text, d);
  return d;
}
