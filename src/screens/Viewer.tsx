import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, copyText, Cover, Icon, ICONS, QrSvg, ThemeButton, useToast } from '../components/ui';
import { listMine, store, type Watcher } from '../data';
import { decodeShare, localPaid, setLocalPaid } from '../data/local';
import { summarize, txKey } from '../lib/calc';
import { dateVi, vnd } from '../lib/format';
import type { PaidMap, Party } from '../lib/types';
import { bankName, vietqrPayload } from '../lib/vietqr';
import { emptyBank, personRows, transferNote } from './steps';

export default function Viewer({ id, encoded }: { id?: string; encoded?: string }) {
  const toast = useToast();
  const [party, setParty] = useState<Party | null>(null);
  const [pid, setPid] = useState(id || '');
  const [paid, setPaid] = useState<PaidMap>({});
  const [error, setError] = useState('');
  const [me, setMe] = useState<string | null>(null);
  const watcher = useRef<Watcher | null>(null);
  const remote = !encoded && store.kind === 'supabase';

  useEffect(() => {
    if (encoded) {
      const d = decodeShare(encoded);
      if (!d) {
        setError('Link không hợp lệ hoặc bị cắt mất một phần.');
        return;
      }
      setParty(d.party);
      setPid(d.id);
      setPaid(localPaid(d.id));
      return;
    }
    if (!id) return;
    let alive = true;
    const load = () =>
      store
        .load(id)
        .then((s) => {
          if (!alive) return;
          if (!s) setError('Không tìm thấy buổi tiệc này.');
          else {
            setParty(s.party);
            setPaid(s.paid);
          }
        })
        .catch((e: Error) => alive && setError(e.message));
    load();
    const w = store.watch(id, load);
    watcher.current = w;
    return () => {
      alive = false;
      w.stop();
    };
  }, [id, encoded]);

  useEffect(() => {
    if (!pid) return;
    try {
      setMe(localStorage.getItem(`chiabill:me:${pid}`));
    } catch {
      /* ignore */
    }
  }, [pid]);

  const pickMe = (m: string | null) => {
    setMe(m);
    try {
      if (m) localStorage.setItem(`chiabill:me:${pid}`, m);
      else localStorage.removeItem(`chiabill:me:${pid}`);
    } catch {
      /* ignore */
    }
  };

  const sum = useMemo(() => (party ? summarize(party) : null), [party]);
  const mine = listMine().find((x) => x.id === pid);

  const toggle = async (k: string) => {
    const next = { ...paid, [k]: !paid[k] };
    setPaid(next);
    try {
      if (remote) {
        await store.setPaid(pid, k, next[k]);
        watcher.current?.ping();
      } else setLocalPaid(pid, k, next[k]);
      toast(next[k] ? 'Đã đánh dấu đã trả. Cảm ơn bạn!' : 'Đã bỏ đánh dấu');
    } catch (e) {
      setPaid(paid);
      toast((e as Error).message);
    }
  };

  if (error)
    return (
      <div className="shell view">
        <main className="mn">
          <div className="page card empty">
            <span className="empty-ic">
              <Icon d={ICONS.warn} size={28} />
            </span>
            <div style={{ fontWeight: 700 }}>{error}</div>
            <a className="btn btn-p" href="#/">
              Về trang chủ
            </a>
          </div>
        </main>
      </div>
    );
  if (!party || !sum)
    return (
      <div className="shell view">
        <main className="mn">
          <div className="hint" style={{ textAlign: 'center', paddingTop: 80 }}>
            Đang tải…
          </div>
        </main>
      </div>
    );

  const nameOf = (x: string) => party.members.find((m) => m.id === x)?.name ?? '?';
  const colorOf = (x: string) => party.members.find((m) => m.id === x)?.color ?? '#41474e';
  const meOk = !!me && party.members.some((m) => m.id === me);
  const net = meOk ? sum.net[me!] : 0;
  const outs = meOk ? sum.txs.filter((t) => t.from === me) : [];
  const ins = meOk ? sum.txs.filter((t) => t.to === me) : [];
  const rows = meOk ? personRows(party, sum, me!) : [];
  const allOutPaid = outs.length > 0 && outs.every((t) => paid[txKey(t)]);

  return (
    <div className="shell view">
      {mine && (
        <div className="row" style={{ flexShrink: 0, gap: 8, padding: '6px 8px 6px 16px', background: 'var(--sel)', color: 'var(--sel-text)', fontSize: 13, fontWeight: 600 }}>
          <Icon d={ICONS.eye} size={16} />
          <span className="grow">Bạn đang xem trang công khai</span>
          <a className="lnk" style={{ color: 'var(--sel-text)', textDecoration: 'underline', display: 'flex', alignItems: 'center' }} href={`#/p/${pid}/sua?k=${mine.key}`}>
            Về trang quản lý
          </a>
        </div>
      )}
      <header className="hd row" style={{ padding: '12px 8px 12px 16px' }}>
        <Cover icon={party.icon} color={party.color} />
        <div className="grow">
          <div style={{ fontWeight: 700, fontSize: 17 }}>{party.name}</div>
          <div className="hint">
            {dateVi(party.date)} · {vnd(sum.grand)}
          </div>
        </div>
        <ThemeButton />
      </header>
      <main className="mn">
        <div className="page stack">
          <section className="stack" style={{ gap: 10 }}>
            <h2 id="me-l">Tôi là…</h2>
            <div className="chips" role="radiogroup" aria-labelledby="me-l">
              {party.members.map((m) => (
                <button key={m.id} role="radio" aria-checked={me === m.id} className={`chip ${me === m.id ? 'on' : ''}`} onClick={() => pickMe(me === m.id ? null : m.id)}>
                  <Avatar name={m.name} color={m.color} />
                  {m.name}
                </button>
              ))}
            </div>
          </section>

          {!meOk ? (
            <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text2)' }}>
              Chọn tên của bạn để xem số tiền cần trả và mã QR.
            </div>
          ) : (
            <>
              <div className="card hero fade">
                <div className="sub">Xin chào {nameOf(me!)}</div>
                <div style={{ fontSize: 26, lineHeight: '34px', fontWeight: 700, marginTop: 4 }}>{net < 0 ? `Bạn cần trả ${vnd(-net)}` : net > 0 ? `Bạn sẽ nhận lại ${vnd(net)}` : 'Bạn không nợ ai cả'}</div>
                <div className="sub" style={{ marginTop: 4 }}>
                  Phần của bạn {vnd(sum.owed[me!])} · đã ứng trước {vnd(sum.paidUp[me!])}
                </div>
              </div>
              {allOutPaid && (
                <div className="card row" style={{ padding: 16, background: 'var(--pos-bg)', color: 'var(--pos)', boxShadow: 'none', fontWeight: 600 }}>
                  <Icon d={ICONS.check} size={24} stroke={2.4} />
                  Bạn đã trả xong phần của mình. Cảm ơn nhé!
                </div>
              )}
              {outs.map((t) => {
                const k = txKey(t);
                const on = !!paid[k];
                const bk = party.bank[t.to] || emptyBank();
                const autoOk = !!bk.bin && bk.acc.length >= 6;
                const useImg = !!bk.qr && (bk.mode !== 'auto' || !autoOk);
                const useAuto = !useImg && autoOk;
                const note = transferNote(nameOf(t.from), nameOf(t.to));
                return (
                  <div key={k} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="row">
                      <Avatar name={nameOf(t.to)} color={colorOf(t.to)} size="l" />
                      <div className="grow">
                        <div style={{ fontWeight: 700 }}>Trả cho {nameOf(t.to)}</div>
                        <div style={{ fontSize: 20, lineHeight: '28px', fontWeight: 700 }}>{vnd(t.amt)}</div>
                      </div>
                      {on && <span className="badge b-pos">Đã trả</span>}
                    </div>
                    {useImg && <img src={bk.qr!} alt={`Mã QR của ${nameOf(t.to)}`} style={{ width: 240, height: 240, objectFit: 'contain', alignSelf: 'center', borderRadius: 12, background: '#fff', border: '1px solid var(--line)' }} />}
                    {useAuto && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <QrSvg size={240} text={vietqrPayload(bk.bin, bk.acc, t.amt, note)} label={`VietQR chuyển ${vnd(t.amt)} cho ${nameOf(t.to)}`} />
                        <span className="hint">VietQR đã điền sẵn số tiền và nội dung</span>
                      </div>
                    )}
                    {!useImg && !useAuto && (
                      <div className="hint" style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg)', fontSize: 14, textAlign: 'center' }}>
                        {nameOf(t.to)} chưa thêm mã QR. Hãy nhắn {nameOf(t.to)} số tài khoản nhé.
                      </div>
                    )}
                    {bk.acc && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', borderRadius: 12, background: 'var(--bg)', fontSize: 14 }}>
                        <div className="kv">
                          <span>Ngân hàng</span>
                          <strong>{bankName(bk.bin) || 'Chưa chọn'}</strong>
                        </div>
                        <div className="kv">
                          <span>Số tài khoản</span>
                          <strong>{bk.acc}</strong>
                        </div>
                        <div className="kv">
                          <span>Chủ tài khoản</span>
                          <strong style={{ textAlign: 'right' }}>{bk.holder || '—'}</strong>
                        </div>
                        <div className="kv">
                          <span>Nội dung</span>
                          <strong>{note}</strong>
                        </div>
                      </div>
                    )}
                    <div className="row" style={{ gap: 8 }}>
                      {bk.acc && (
                        <button className="btn btn-o btn-s" style={{ flex: 1, padding: '0 8px' }} onClick={async () => toast((await copyText(bk.acc)) ? `Đã sao chép số tài khoản của ${nameOf(t.to)}` : 'Không sao chép được')}>
                          <Icon d={ICONS.copy} size={18} />
                          Sao chép số tài khoản
                        </button>
                      )}
                      <button className={`btn btn-s ${on ? 'btn-o' : 'btn-p'}`} style={{ flex: 1, padding: '0 8px' }} aria-pressed={on} onClick={() => toggle(k)}>
                        {on ? 'Bỏ đánh dấu' : 'Tôi đã trả'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {ins.map((t) => {
                const on = !!paid[txKey(t)];
                return (
                  <div key={txKey(t)} className="card row" style={{ padding: '12px 16px', minHeight: 64 }}>
                    <Avatar name={nameOf(t.from)} color={colorOf(t.from)} />
                    <span className="grow">
                      {nameOf(t.from)} sẽ trả bạn <strong>{vnd(t.amt)}</strong>
                    </span>
                    <span className={`badge ${on ? 'b-pos' : 'b-neu'}`}>{on ? 'Đã nhận' : 'Chờ trả'}</span>
                  </div>
                );
              })}
              <section className="stack" style={{ gap: 10 }}>
                <h2>Phần của bạn trong từng hóa đơn</h2>
                <div className="card list" style={{ padding: '0 16px' }}>
                  {rows.length ? (
                    rows.map((r) => (
                      <div key={r.id} className="kv" style={{ alignItems: 'center', minHeight: 44, fontSize: 14 }}>
                        <span className="row" style={{ gap: 6, color: 'var(--text2)' }}>
                          {r.name}
                          {r.spLabel && <span className="badge b-gift">bạn {r.spLabel}</span>}
                        </span>
                        <strong>{vnd(r.amt)}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="hint" style={{ padding: '12px 0' }}>
                      Bạn không tham gia hóa đơn nào.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          <section className="stack" style={{ gap: 10 }}>
            <h2>Tất cả khoản chuyển</h2>
            {sum.txs.length === 0 ? (
              <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text2)' }}>
                Không ai nợ ai cả.
              </div>
            ) : (
              <div className="card list">
                {sum.txs.map((t) => {
                  const on = !!paid[txKey(t)];
                  const hl = meOk && (t.from === me || t.to === me);
                  return (
                    <div key={txKey(t)} className="row" style={{ gap: 8, padding: '10px 16px', minHeight: 56, background: hl ? 'var(--sel)' : undefined }}>
                      <Avatar name={nameOf(t.from)} color={colorOf(t.from)} size="s" />
                      <span className="grow" style={{ fontSize: 14 }}>
                        {nameOf(t.from)} → {nameOf(t.to)} · <strong>{vnd(t.amt)}</strong>
                      </span>
                      <span className={`badge ${on ? 'b-pos' : 'b-neu'}`}>{on ? 'Đã trả' : 'Chưa trả'}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {!remote && <div className="hint">Trạng thái “Đã trả” chỉ lưu trên máy của bạn.</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
