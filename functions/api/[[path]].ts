/**
 * Cloudflare Pages Function: JSON API backed by D1 (binding `DB`).
 *
 *   POST   /api/parties                 body {id, party}, header X-Edit-Key  -> create
 *   GET    /api/parties/:id             -> {party, paid, updatedAt}
 *   PUT    /api/parties/:id             body {party}, header X-Edit-Key      -> save
 *   DELETE /api/parties/:id             header X-Edit-Key                    -> delete
 *   POST   /api/parties/:id/paid        body {tx, paid}                      -> mark transfer
 *
 * Anyone with the (random) party id can view it and mark a transfer paid.
 * Editing needs the organiser key, stored only as a SHA-256 hash.
 */

interface D1Result<T> {
  results: T[];
}
interface D1Statement {
  bind(...v: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<{ meta: { changes: number } }>;
}
interface D1 {
  prepare(sql: string): D1Statement;
}
interface Env {
  DB: D1;
}

// D1 caps a row at 2 MB.
const MAX_BYTES = 1_900_000;
const ID_RE = /^[a-z0-9]{6,32}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const err = (message: string, status: number) => json({ error: message }, status);

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const onRequest = async ({ request, env, params }: { request: Request; env: Env; params: { path?: string[] } }) => {
  const seg = params.path || [];
  if (seg[0] !== 'parties') return err('Not found', 404);
  const db = env.DB;
  const id = seg[1];
  const sub = seg[2];
  const method = request.method;

  try {
    if (!id) {
      if (method !== 'POST') return err('Method not allowed', 405);
      const key = request.headers.get('x-edit-key') || '';
      const body = (await request.json()) as { id?: string; party?: unknown };
      if (!body.id || !ID_RE.test(body.id) || key.length < 12 || !body.party) return err('Yêu cầu không hợp lệ', 400);
      const data = JSON.stringify(body.party);
      if (data.length > MAX_BYTES) return err('Dữ liệu quá lớn (tối đa ~1.9MB). Hãy xóa bớt ảnh.', 413);
      const now = Date.now();
      await db
        .prepare('INSERT INTO parties (id, data, edit_key_hash, created_at, updated_at) VALUES (?,?,?,?,?)')
        .bind(body.id, data, await sha256(key), now, now)
        .run();
      return json({ ok: true }, 201);
    }

    if (!ID_RE.test(id)) return err('Not found', 404);

    if (!sub) {
      if (method === 'GET') {
        const row = await db.prepare('SELECT data, updated_at FROM parties WHERE id = ?').bind(id).first<{ data: string; updated_at: number }>();
        if (!row) return err('Không tìm thấy buổi tiệc', 404);
        const pays = await db.prepare('SELECT tx_key, paid FROM payments WHERE party_id = ?').bind(id).all<{ tx_key: string; paid: number }>();
        const paid: Record<string, boolean> = {};
        for (const p of pays.results) paid[p.tx_key] = !!p.paid;
        return json({ party: JSON.parse(row.data), paid, updatedAt: row.updated_at });
      }

      const key = request.headers.get('x-edit-key') || '';
      const hash = await sha256(key);

      if (method === 'PUT') {
        const body = (await request.json()) as { party?: unknown };
        if (!body.party) return err('Yêu cầu không hợp lệ', 400);
        const data = JSON.stringify(body.party);
        if (data.length > MAX_BYTES) return err('Dữ liệu quá lớn (tối đa ~1.9MB). Hãy xóa bớt ảnh.', 413);
        const r = await db
          .prepare('UPDATE parties SET data = ?, updated_at = ? WHERE id = ? AND edit_key_hash = ?')
          .bind(data, Date.now(), id, hash)
          .run();
        if (!r.meta.changes) return err('Không có quyền sửa buổi tiệc này', 403);
        return json({ ok: true });
      }

      if (method === 'DELETE') {
        await db.prepare('DELETE FROM payments WHERE party_id IN (SELECT id FROM parties WHERE id = ? AND edit_key_hash = ?)').bind(id, hash).run();
        const r = await db.prepare('DELETE FROM parties WHERE id = ? AND edit_key_hash = ?').bind(id, hash).run();
        if (!r.meta.changes) return err('Không có quyền xóa buổi tiệc này', 403);
        return json({ ok: true });
      }
      return err('Method not allowed', 405);
    }

    if (sub === 'paid' && method === 'POST') {
      const body = (await request.json()) as { tx?: string; paid?: boolean };
      if (!body.tx || body.tx.length > 80 || typeof body.paid !== 'boolean') return err('Yêu cầu không hợp lệ', 400);
      const exists = await db.prepare('SELECT 1 AS x FROM parties WHERE id = ?').bind(id).first();
      if (!exists) return err('Không tìm thấy buổi tiệc', 404);
      await db
        .prepare(
          'INSERT INTO payments (party_id, tx_key, paid, updated_at) VALUES (?,?,?,?) ON CONFLICT(party_id, tx_key) DO UPDATE SET paid = excluded.paid, updated_at = excluded.updated_at',
        )
        .bind(id, body.tx, body.paid ? 1 : 0, Date.now())
        .run();
      return json({ ok: true });
    }

    return err('Not found', 404);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    if (/UNIQUE|constraint/i.test(msg)) return err('Mã buổi tiệc đã tồn tại', 409);
    return err('Lỗi máy chủ', 500);
  }
};
