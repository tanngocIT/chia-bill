export function num(n: number): string {
  const s = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + s;
}

export function vnd(n: number): string {
  return num(n) + 'đ';
}

/** Round to the nearest 1.000đ */
export function r1k(x: number): number {
  return Math.round(x / 1000) * 1000;
}

/** Parse "1.250.000" / "1250000đ" into an integer */
export function parseAmount(s: string, maxDigits = 12): number {
  const d = s.replace(/\D/g, '').slice(0, maxDigits);
  return d ? parseInt(d, 10) : 0;
}

/** Vietnamese names put the given name last: "Nguyễn Văn Tuấn" -> "T" */
export function initial(name: string): string {
  const w = String(name || '?').trim().split(/\s+/);
  return (w[w.length - 1] || '?').charAt(0).toUpperCase();
}

export function ascii(s: string): string {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function dateVi(s: string): string {
  if (!s) return 'Chưa chọn ngày';
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${WEEKDAYS[d.getDay()]}, ${dd}/${mm}/${d.getFullYear()}`;
}

export function joinNames(arr: string[]): string {
  if (arr.length <= 1) return arr.join('');
  return arr.slice(0, -1).join(', ') + ' và ' + arr[arr.length - 1];
}

export function uid(prefix = ''): string {
  const r = crypto.getRandomValues(new Uint8Array(6));
  return prefix + Array.from(r, (b) => (b % 36).toString(36)).join('') + Date.now().toString(36).slice(-3);
}

/** Random URL-safe id for parties / edit keys */
export function randomId(len = 10): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(r, (b) => alphabet[b % alphabet.length]).join('');
}
