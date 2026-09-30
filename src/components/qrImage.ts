import { qrMatrix } from '../lib/qr';

export interface QrImageSource {
  /** VietQR payload to render as a QR code */
  payload?: string;
  /** or an uploaded QR screenshot (data URL) */
  imageUrl?: string;
  /** caption lines printed under the code, e.g. "Trả cho Minh · 2.490.000đ" */
  caption?: string[];
}

const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không đọc được ảnh QR'));
    img.src = src;
  });
}

/** Render the QR (plus caption) to a PNG blob. */
export async function qrToPng(src: QrImageSource): Promise<Blob> {
  const size = 720;
  const pad = 40;
  const caption = src.caption ?? [];
  const capH = caption.length ? 24 + caption.length * 40 : 0;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size + capH;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ tạo ảnh');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);

  if (src.payload) {
    const M = qrMatrix(src.payload);
    if (!M) throw new Error('Không tạo được mã QR');
    const n = M.length;
    const cell = Math.floor((size - pad * 2) / n);
    const off = Math.floor((size - cell * n) / 2);
    ctx.fillStyle = '#0c0d0e';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (M[y][x]) ctx.fillRect(off + x * cell, off + y * cell, cell, cell);
  } else if (src.imageUrl) {
    const img = await loadImage(src.imageUrl);
    const k = Math.min((size - pad * 2) / img.width, (size - pad * 2) / img.height);
    const w = img.width * k;
    const h = img.height * k;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  } else throw new Error('Chưa có mã QR');

  ctx.fillStyle = '#0c0d0e';
  ctx.textAlign = 'center';
  caption.forEach((line, i) => {
    ctx.font = `${i === 0 ? 700 : 400} ${i === 0 ? 30 : 26}px ${FONT}`;
    ctx.fillText(line, size / 2, size + 8 + (i + 1) * 40 - 10);
  });

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh'))), 'image/png'));
}

/** Copy the QR image to the clipboard. Returns false when the browser can't. */
export async function copyQrImage(src: QrImageSource): Promise<boolean> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false;
  try {
    // Passing the promise (not the blob) keeps Safari's user-gesture requirement happy.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': qrToPng(src) })]);
    return true;
  } catch {
    return false;
  }
}

export async function downloadQrImage(src: QrImageSource, filename: string): Promise<void> {
  const blob = await qrToPng(src);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** First image file in a paste event, if any. */
export function imageFromPaste(e: { clipboardData: DataTransfer | null }): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const it of Array.from(items)) {
    if (it.kind === 'file' && it.type.startsWith('image/')) return it.getAsFile();
  }
  return null;
}

/**
 * Read an image from the clipboard (needs a user click and browser permission).
 * Returns 'unsupported' when the browser has no async clipboard read, null when
 * the clipboard holds no image.
 */
export async function readClipboardImage(): Promise<File | null | 'unsupported'> {
  if (!navigator.clipboard || !('read' in navigator.clipboard)) return 'unsupported';
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find((t) => t.startsWith('image/'));
      if (type) {
        const blob = await it.getType(type);
        return new File([blob], 'qr.' + (type.split('/')[1] || 'png'), { type });
      }
    }
    return null;
  } catch {
    return 'unsupported';
  }
}
