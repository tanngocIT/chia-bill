/**
 * Read an image file and compress it client-side (max 1200px, JPEG) so the
 * result stays under `maxBytes` (default 2MB). Returns a data URL.
 */
export function compressImage(file: File, maxBytes = 2 * 1024 * 1024, maxSide = 1200): Promise<{ url: string; kb: number }> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) {
      reject(new Error('Chỉ nhận file ảnh'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được ảnh này'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không đọc được ảnh này'));
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * k);
        const h = Math.round(img.height * k);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) {
          reject(new Error('Trình duyệt không hỗ trợ nén ảnh'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        let q = 0.88;
        let url = c.toDataURL('image/jpeg', q);
        while (url.length * 0.75 > maxBytes && q > 0.3) {
          q -= 0.15;
          url = c.toDataURL('image/jpeg', q);
        }
        resolve({ url, kb: Math.round((url.length * 0.75) / 1024) });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
