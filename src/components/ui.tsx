import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { initial, num } from '../lib/format';
import { qrPath } from '../lib/qr';

/* ---------------- icons ---------------- */
export const ICONS = {
  back: 'M15 18l-6-6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9 7 12 7zM12 7c1.5-3 5-3.5 5-1.2C17 7 15 7 12 7z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  chevron: 'M6 9l6 6 6-6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2 .8 3.5 3 3.5 6',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  warn: 'M12 3l10 18H2zM12 10v4M12 17.5h.01',
  home: 'M4 11l8-7 8 7v9H4zM10 20v-5h4v5',
} as const;

export const COVERS = [
  { k: 'beach', label: 'Biển', path: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 17c2.5 0 2.5-1.5 5-1.5s2.5 1.5 5 1.5 2.5-1.5 5-1.5 2.5 1.5 5 1.5M2 21c2.5 0 2.5-1.5 5-1.5s2.5 1.5 5 1.5 2.5-1.5 5-1.5 2.5 1.5 5 1.5' },
  { k: 'food', label: 'Ăn uống', path: 'M3 11h18a9 9 0 0 1-18 0zM8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4' },
  { k: 'cake', label: 'Sinh nhật', path: 'M4 21h16v-8H4zM4 16c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M12 13V9M12 6.5c-1 0-1.5-.8-1.5-1.5S12 3 12 3s1.5 1.3 1.5 2-.5 1.5-1.5 1.5z' },
  { k: 'music', label: 'Karaoke', path: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' },
  { k: 'car', label: 'Du lịch', path: 'M5 16h14v-4l-2-5H7l-2 5zM3 12h18M7 16v3M17 16v3M7.5 13.5h.01M16.5 13.5h.01' },
  { k: 'star', label: 'Tiệc', path: 'M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z' },
];
export const coverPath = (k: string) => (COVERS.find((c) => c.k === k) || COVERS[0]).path;

export function Icon({ d, size = 20, stroke = 2, fill = 'none', className }: { d: string; size?: number; stroke?: number; fill?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}

export function Avatar({ name, color, size = '', label }: { name: string; color: string; size?: '' | 'l' | 's'; label?: string }) {
  return (
    <span className={`av${size ? ' av-' + size : ''}`} style={{ background: color }} aria-label={label} aria-hidden={label ? undefined : true}>
      {initial(name)}
    </span>
  );
}

export function Cover({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  return (
    <span className="cover-ic" style={{ width: size, height: size, background: color, borderRadius: size * 0.3 }}>
      <Icon d={coverPath(icon)} size={Math.round(size * 0.52)} stroke={1.8} />
    </span>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { k: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.k} role="tab" aria-selected={value === o.k} className={value === o.k ? 'on' : ''} onClick={() => onChange(o.k)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function QrSvg({ text, size = 168, label }: { text: string; size?: number; label: string }) {
  return (
    <svg className="qr" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
      <path d={qrPath(text)} fill="#0c0d0e" />
    </svg>
  );
}

export function MoneyInput({ id, value, onChange, placeholder = '0', big, invalid, label }: { id: string; value: number; onChange: (n: number) => void; placeholder?: string; big?: boolean; invalid?: boolean; label?: string }) {
  return (
    <div className="money">
      <input
        id={id}
        className={`inp${invalid ? ' err' : ''}`}
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        placeholder={placeholder}
        value={value ? num(value) : ''}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '').slice(0, 12);
          onChange(d ? parseInt(d, 10) : 0);
        }}
        style={big ? { fontSize: 22, fontWeight: 700, minHeight: 60 } : undefined}
      />
      <span aria-hidden="true" style={big ? { fontSize: 20 } : undefined}>đ</span>
    </div>
  );
}

export function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="card empty">
      <span className="empty-ic">
        <Icon d={icon} size={28} stroke={1.8} />
      </span>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
      <div className="hint" style={{ fontSize: 14 }}>
        {sub}
      </div>
    </div>
  );
}

export function Confetti() {
  const colors = ['#3c66ff', '#a1d26a', '#e4b774', '#002a61', '#eeafaf'];
  return (
    <>
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} className="conf" style={{ left: `${(i * 6.3 + 3) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 8) * 0.2}s` }} />
      ))}
    </>
  );
}

/* ---------------- dialogs ---------------- */
export function ConfirmDialog({ title, desc, okLabel, onOk, onCancel }: { title: string; desc: string; okLabel: string; onOk: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onCancel]);
  return (
    <div className="dlg-wrap">
      <div className="card dlg" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-d">
        <span className="empty-ic" style={{ width: 48, height: 48, background: 'var(--danger-bg)', color: 'var(--danger)' }}>
          <Icon d={ICONS.warn} size={24} />
        </span>
        <h2 id="cf-t">{title}</h2>
        <p id="cf-d" style={{ color: 'var(--text2)' }}>
          {desc}
        </p>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button ref={ref} className="btn btn-o" style={{ flex: 1 }} onClick={onCancel}>
            Hủy
          </button>
          <button className="btn btn-d" style={{ flex: 1 }} onClick={onOk}>
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- toast ---------------- */
interface ToastState {
  t: string;
  undo?: () => void;
  k: number;
}
const ToastCtx = createContext<(t: string, undo?: () => void) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number>();
  const show = useCallback((t: string, undo?: () => void) => {
    setToast({ t, undo, k: Date.now() });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), undo ? 4500 : 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div key={toast.k} className="toast" role="status" aria-live="polite">
          <span className="grow">{toast.t}</span>
          {toast.undo && (
            <button
              className="lnk"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Hoàn tác
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

/* ---------------- helpers ---------------- */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function useTheme(): [boolean, () => void] {
  const get = () => {
    const t = document.documentElement.dataset.theme;
    if (t) return t === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  };
  const [dark, setDark] = useState(get);
  const toggle = () => {
    const next = !get();
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('chiabill:theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    setDark(next);
  };
  return [dark, toggle];
}

export function ThemeButton({ withLabel }: { withLabel?: boolean }) {
  const [dark, toggle] = useTheme();
  const label = dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  if (withLabel)
    return (
      <button className="dnav" onClick={toggle}>
        <Icon d={dark ? ICONS.sun : ICONS.moon} size={22} />
        {dark ? 'Giao diện sáng' : 'Giao diện tối'}
      </button>
    );
  return (
    <button className="ibtn" aria-label={label} onClick={toggle}>
      <Icon d={dark ? ICONS.sun : ICONS.moon} size={22} />
    </button>
  );
}
