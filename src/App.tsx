import { useEffect, useState } from 'react';
import Home from './screens/Home';
import Organizer from './screens/Organizer';
import Viewer from './screens/Viewer';

/**
 * Hash routes (GitHub Pages has no server-side routing):
 *   #/                     home
 *   #/p/:id/sua?k=KEY      organiser (edit)
 *   #/p/:id                public view (Supabase)
 *   #/v/:data              public view, data inside the link (no backend)
 */
export function navigate(route: string) {
  window.location.hash = route;
}

function parse(hash: string) {
  const h = hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  const q = new URLSearchParams(qs || '');
  const seg = path.split('/').filter(Boolean);
  return { seg, q };
}

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const h = () => setHash(window.location.hash);
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const { seg, q } = parse(hash);
  if (seg[0] === 'p' && seg[1] && seg[2] === 'sua') return <Organizer key={seg[1]} id={seg[1]} editKey={q.get('k') || ''} />;
  if (seg[0] === 'p' && seg[1]) return <Viewer key={seg[1]} id={seg[1]} />;
  if (seg[0] === 'v' && seg[1]) return <Viewer key={seg[1].slice(0, 24)} encoded={seg[1]} />;
  return <Home />;
}
