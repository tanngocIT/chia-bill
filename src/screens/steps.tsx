import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { copyQrImage, downloadQrImage, imageFromPaste, readClipboardImage, type QrImageSource } from '../components/qrImage';
import { absoluteUrl, store } from '../data';
import { Avatar, Confetti, copyText, COVERS, Cover, Empty, Icon, ICONS, QrSvg, Seg, useToast } from '../components/ui';
import { txKey, type Summary } from '../lib/calc';
import { ascii, dateVi, joinNames, uid, vnd } from '../lib/format';
import { compressImage } from '../lib/image';
import { AVATAR_COLORS, THEME_COLORS } from '../lib/sample';
import type { BankInfo, Bill, PaidMap, Party, SettleMode } from '../lib/types';
import { BANKS, bankName, vietqrPayload } from '../lib/vietqr';
import type { Update } from './Organizer';

export const transferNote = (from: string, to: string) => ascii(`${from} tra ${to}`).slice(0, 25);
export const emptyBank = (): BankInfo => ({ mode: 'upload', bin: '', acc: '', holder: '', qr: null });

const who = (p: Party) => {
  const m = new Map(p.members.map((x) => [x.id, x]));
  return {
    name: (id: string) => m.get(id)?.name ?? '?',
    color: (id: string) => m.get(id)?.color ?? '#41474e',
  };
};

/* ================= 1. Party ================= */
export function StepParty({ party, update, tried }: { party: Party; update: Update; tried: boolean }) {
  const err = tried && !party.name.trim();
  return (
    <>
      <div className="card row" style={{ padding: 20, gap: 16 }}>
        <Cover icon={party.icon} color={party.color} size={64} />
        <div className="grow">
          <div style={{ fontSize: 20, lineHeight: '26px', fontWeight: 700, overflowWrap: 'anywhere' }}>{party.name.trim() || 'Buổi tiệc chưa có tên'}</div>
          <div className="hint" style={{ fontSize: 14 }}>
            {dateVi(party.date)}
          </div>
        </div>
      </div>
      <div className="field">
        <label className="lbl" htmlFor="pn">
          Tên buổi tiệc
        </label>
        <input id="pn" className={`inp ${err ? 'err' : ''}`} value={party.name} maxLength={60} autoComplete="off" placeholder="VD: Sinh nhật Linh, Đà Lạt 3 ngày" onChange={(e) => update((p) => void (p.name = e.target.value))} />
        {err && <div className="err-text">Đặt tên cho buổi tiệc để tiếp tục nhé.</div>}
      </div>
      <div className="field">
        <label className="lbl" htmlFor="pd">
          Ngày
        </label>
        <input id="pd" className="inp" type="date" value={party.date} onChange={(e) => update((p) => void (p.date = e.target.value))} />
      </div>
      <div className="field">
        <div className="lbl" id="cov-l">
          Biểu tượng
        </div>
        <div role="group" aria-labelledby="cov-l" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
          {COVERS.map((c) => (
            <button key={c.k} className={`cov ${party.icon === c.k ? 'on' : ''}`} aria-label={c.label} aria-pressed={party.icon === c.k} onClick={() => update((p) => void (p.icon = c.k))}>
              <Icon d={c.path} size={24} stroke={1.8} />
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <div className="lbl" id="col-l">
          Màu chủ đề
        </div>
        <div role="group" aria-labelledby="col-l" className="chips" style={{ gap: 12, padding: 4 }}>
          {THEME_COLORS.map((c) => (
            <button key={c.hex} className={`swt ${party.color === c.hex ? 'on' : ''}`} style={{ background: c.hex }} aria-label={c.label} aria-pressed={party.color === c.hex} onClick={() => update((p) => void (p.color = c.hex))} />
          ))}
        </div>
      </div>
    </>
  );
}

/* ================= 2. Members ================= */
export function StepMembers({ party, update, org, onRemove }: { party: Party; update: Update; org: string | null; onRemove: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const addNames = (raw: string) => {
    const names = raw
      .split(/[,\n;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!names.length) return;
    const exist = new Set(party.members.map((m) => m.name.toLowerCase()));
    const add: { id: string; name: string; color: string }[] = [];
    names.forEach((n) => {
      if (exist.has(n.toLowerCase())) return;
      exist.add(n.toLowerCase());
      add.push({ id: uid('m'), name: n.slice(0, 30), color: AVATAR_COLORS[(party.members.length + add.length) % AVATAR_COLORS.length] });
    });
    update((p) => {
      p.members.push(...add);
      if (!p.organiser && p.members[0]) p.organiser = p.members[0].id;
    });
    setName('');
    toast(add.length > 1 ? `Đã thêm ${add.length} người` : add.length ? `Đã thêm ${add[0].name}` : 'Tên này đã có trong danh sách rồi');
  };

  const saveEdit = (id: string) => {
    const v = editName.trim();
    if (v) update((p) => void (p.members.find((m) => m.id === id)!.name = v.slice(0, 30)));
    setEditId(null);
  };

  return (
    <>
      <div className="field">
        <label className="lbl" htmlFor="nm">
          Tên thành viên
        </label>
        <div className="row" style={{ gap: 8 }}>
          <input
            id="nm"
            className="inp grow"
            value={name}
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Nhập tên rồi nhấn Enter"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addNames(name);
              }
            }}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text');
              if (/[,\n;]/.test(t)) {
                e.preventDefault();
                addNames(t);
              }
            }}
          />
          <button className="btn btn-p" style={{ width: 52, padding: 0, flexShrink: 0 }} aria-label="Thêm thành viên" onClick={() => addNames(name)}>
            <Icon d={ICONS.plus} size={22} stroke={2.2} />
          </button>
        </div>
        <div className="hint">Mẹo: dán cả danh sách, các tên cách nhau bằng dấu phẩy hoặc xuống dòng.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h2>{party.members.length} thành viên</h2>
        <div className="hint">Chạm ngôi sao để chọn người tổ chức. Mọi người chuyển tiền cho người này, rồi người này trả lại cho ai đã ứng trước.</div>
      </div>
      {party.members.length === 0 ? (
        <Empty icon={ICONS.users} title="Chưa có ai cả" sub="Thêm người đầu tiên nhé!" />
      ) : (
        <div className="card list">
          {party.members.map((m) => {
            const used = party.bills.filter((b) => b.parts.includes(m.id)).length;
            const isOrg = m.id === org;
            return (
              <div key={m.id} className="li" style={{ paddingRight: 8 }}>
                <button
                  className="av av-l"
                  style={{ background: m.color }}
                  aria-label={`Đổi màu avatar của ${m.name}`}
                  onClick={() => update((p) => void (p.members.find((x) => x.id === m.id)!.color = AVATAR_COLORS[(AVATAR_COLORS.indexOf(m.color) + 1) % AVATAR_COLORS.length]))}
                >
                  {m.name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase()}
                </button>
                {editId === m.id ? (
                  <>
                    <input
                      className="inp grow"
                      style={{ minHeight: 44 }}
                      value={editName}
                      autoFocus
                      aria-label={`Sửa tên ${m.name}`}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(m.id);
                        if (e.key === 'Escape') setEditId(null);
                      }}
                    />
                    <button className="ibtn" style={{ color: 'var(--pos)' }} aria-label="Lưu tên" onClick={() => saveEdit(m.id)}>
                      <Icon d={ICONS.check} size={22} stroke={2.2} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                      <span className="hint">
                        {isOrg ? 'Người tổ chức · ' : ''}
                        {m.sponsorOnly ? 'Chỉ tài trợ · ' : ''}
                        {used ? `Có trong ${used} hóa đơn` : 'Chưa có trong hóa đơn nào'}
                      </span>
                    </div>
                    <button
                      className="ibtn"
                      style={{ color: isOrg ? 'var(--warn)' : 'var(--text3)' }}
                      aria-pressed={isOrg}
                      aria-label={isOrg ? `${m.name} là người tổ chức` : `Đặt ${m.name} làm người tổ chức`}
                      onClick={() => {
                        if (isOrg) return;
                        update((p) => void (p.organiser = m.id));
                        toast(`${m.name} là người tổ chức`);
                      }}
                    >
                      <Icon d={ICONS.star} fill={isOrg ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      className="ibtn"
                      aria-label={`Sửa tên ${m.name}`}
                      onClick={() => {
                        setEditId(m.id);
                        setEditName(m.name);
                      }}
                    >
                      <Icon d={ICONS.edit} />
                    </button>
                    <button className="ibtn" style={{ color: 'var(--danger)' }} aria-label={`Xóa ${m.name}`} onClick={() => onRemove(m.id)}>
                      <Icon d={ICONS.trash} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ================= 3. Bills ================= */
function sponsorText(p: Party, b: Bill, sum: Summary) {
  const c = sum.calcs[b.id];
  if (!c || !c.sps.length) return '';
  const names = joinNames(c.sps.map(who(p).name));
  return b.sponsorType === 'full' ? `${names} bao` : `${names} tài trợ ${vnd(c.spTotal)}`;
}

function BillCard({ party, bill, sum, open, onOpen, onDelete, onSwipe }: { party: Party; bill: Bill; sum: Summary; open: boolean; onOpen: () => void; onDelete: () => void; onSwipe: (open: boolean) => void }) {
  const W = who(party);
  const c = sum.calcs[bill.id];
  const [drag, setDrag] = useState<number | null>(null);
  const sw = useRef<{ x0: number; y0: number; base: number; moved: boolean } | null>(null);
  const justSwiped = useRef(false);
  const dx = drag ?? (open ? -96 : 0);
  const spText = sponsorText(party, bill, sum);

  const down = (e: RPE) => (sw.current = { x0: e.clientX, y0: e.clientY, base: open ? -96 : 0, moved: false });
  const move = (e: RPE) => {
    const w = sw.current;
    if (!w) return;
    const ddx = e.clientX - w.x0;
    const ddy = e.clientY - w.y0;
    if (!w.moved && Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy)) {
      w.moved = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (w.moved) setDrag(Math.max(-130, Math.min(0, w.base + ddx)));
  };
  const up = () => {
    const w = sw.current;
    sw.current = null;
    if (!w || !w.moved) return;
    justSwiped.current = true;
    setTimeout(() => (justSwiped.current = false), 60);
    onSwipe((drag ?? 0) < -50);
    setDrag(null);
  };

  return (
    <div className="swipe">
      <div className="swipe-bg">
        <button className="swipe-del" aria-label={`Xóa hóa đơn ${bill.name}`} onClick={onDelete}>
          <Icon d={ICONS.trash} size={22} />
          <span>Xóa</span>
        </button>
      </div>
      <button
        type="button"
        className={`card billc ${drag == null ? 'anim' : ''}`}
        style={{ transform: `translateX(${dx}px)` }}
        aria-label={`Sửa hóa đơn ${bill.name}, ${vnd(bill.amount)}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          if (justSwiped.current) return;
          if (open) onSwipe(false);
          else onOpen();
        }}
      >
        <span className="row" style={{ alignItems: 'flex-start', width: '100%' }}>
          <span className="bill-ic">
            <Icon d={ICONS.receipt} />
          </span>
          <span className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{bill.name}</span>
            <span className="hint">
              {W.name(bill.payer || '')} trả · {c.parts.length} người tham gia
            </span>
          </span>
          <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>{vnd(bill.amount)}</span>
        </span>
        <span className="row" style={{ justifyContent: 'space-between', width: '100%', gap: 8 }}>
          <span className="av-stack">
            {c.parts.map((id) => (
              <Avatar key={id} name={W.name(id)} color={W.color(id)} size="s" />
            ))}
          </span>
          {spText && (
            <span className="badge b-gift">
              <Icon d={ICONS.gift} size={14} stroke={2.2} />
              {spText}
            </span>
          )}
        </span>
        {bill.note && (
          <span className="hint" style={{ fontStyle: 'italic' }}>
            {bill.note}
          </span>
        )}
        {bill.photo && (
          <span className="hint row" style={{ gap: 6 }}>
            <Icon d={ICONS.camera} size={16} />
            Có ảnh hóa đơn
          </span>
        )}
      </button>
    </div>
  );
}

export function StepBills({ party, sum, onOpen, onDelete }: { party: Party; sum: Summary; update: Update; onOpen: (b: Bill) => void; onDelete: (id: string) => void }) {
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);
  if (!party.bills.length) return <Empty icon={ICONS.receipt} title="Chưa có hóa đơn nào" sub="Thêm hóa đơn đầu tiên nhé!" />;
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h2>{party.bills.length} hóa đơn</h2>
        <span style={{ fontSize: 14, color: 'var(--text3)' }}>
          Tổng <strong style={{ color: 'var(--text)', fontSize: 16 }}>{vnd(sum.grand)}</strong>
        </span>
      </div>
      <div className="stack" style={{ gap: 12 }}>
        {party.bills.map((b) => (
          <BillCard
            key={b.id}
            party={party}
            bill={b}
            sum={sum}
            open={openSwipe === b.id}
            onSwipe={(o) => setOpenSwipe(o ? b.id : null)}
            onOpen={() => onOpen(b)}
            onDelete={() => {
              setOpenSwipe(null);
              onDelete(b.id);
            }}
          />
        ))}
      </div>
      <div className="hint" style={{ textAlign: 'center' }}>
        Chạm để sửa · vuốt sang trái để xóa
      </div>
    </>
  );
}

/* ================= 4. Summary ================= */
export function txSubText(p: Party, sum: Summary) {
  const W = who(p);
  if (!sum.txs.length) return 'Mọi người đã cân bằng.';
  if (sum.hub && sum.org) return `Mọi người chuyển cho ${W.name(sum.org)}, ${W.name(sum.org)} trả lại cho người đã ứng trước.`;
  return `Gộp nợ để chỉ cần ${sum.txs.length} lần chuyển khoản.`;
}

function netBadge(n: number) {
  return n > 0 ? { cls: 'b-pos', t: 'Nhận ' + vnd(n) } : n < 0 ? { cls: 'b-neg', t: 'Trả ' + vnd(-n) } : { cls: 'b-neu', t: 'Cân bằng' };
}

export function personRows(p: Party, sum: Summary, id: string) {
  return p.bills
    .filter((b) => sum.calcs[b.id].total[id] != null)
    .map((b) => {
      const c = sum.calcs[b.id];
      const spv = c.sp[id] || 0;
      return { id: b.id, name: b.name, amt: c.total[id], spLabel: spv > 0 ? (b.sponsorType === 'full' ? 'bao trọn' : 'tài trợ ' + vnd(spv)) : '' };
    });
}

export function TxRow({ p, from, to, amt, right }: { p: Party; from: string; to: string; amt: number; right?: React.ReactNode }) {
  const W = who(p);
  return (
    <div className="li" style={{ gap: 8 }}>
      <Avatar name={W.name(from)} color={W.color(from)} />
      <span style={{ color: 'var(--text3)', display: 'flex' }}>
        <Icon d={ICONS.arrow} size={18} />
      </span>
      <Avatar name={W.name(to)} color={W.color(to)} />
      <span className="grow" style={{ display: 'flex', flexDirection: 'column', paddingLeft: 4 }}>
        <span style={{ fontWeight: 600 }}>
          {W.name(from)} trả {W.name(to)}
        </span>
        <span className="hint">{vnd(amt)}</span>
      </span>
      {right}
    </div>
  );
}

export function StepSummary({ party, sum, update, paid }: { party: Party; sum: Summary; update: Update; paid: PaidMap }) {
  const W = who(party);
  const [openP, setOpenP] = useState<Record<string, boolean>>({});
  const [openB, setOpenB] = useState<Record<string, boolean>>({});
  const n = party.members.length;
  return (
    <>
      <div className="card hero">
        <div className="sub">Tổng chi · {party.name}</div>
        <div style={{ fontSize: 32, lineHeight: '40px', fontWeight: 700, marginTop: 4 }}>{vnd(sum.grand)}</div>
        <div className="sub" style={{ marginTop: 4 }}>
          {party.bills.length} hóa đơn · {n} người · trung bình {vnd(n ? Math.round(sum.grand / n / 1000) * 1000 : 0)}/người
        </div>
      </div>

      <section className="stack" style={{ gap: 12 }}>
        <div>
          <h2>Ai trả cho ai</h2>
          <div className="hint" style={{ fontSize: 14, marginTop: 2 }}>
            {txSubText(party, sum)}
          </div>
        </div>
        <Seg<SettleMode>
          label="Cách thanh toán"
          value={sum.hub ? 'hub' : 'min'}
          options={[
            { k: 'hub', label: 'Qua người tổ chức' },
            { k: 'min', label: 'Ít lần chuyển nhất' },
          ]}
          onChange={(k) => update((p) => void (p.settleMode = k))}
        />
        {sum.txs.length ? (
          <div className="card list">
            {sum.txs.map((t) => (
              <TxRow key={txKey(t)} p={party} {...t} right={paid[txKey(t)] ? <span className="badge b-pos">Đã trả</span> : undefined} />
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text2)' }}>
            Không ai nợ ai. Mọi người đã cân bằng rồi!
          </div>
        )}
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <h2>Từng người</h2>
        <div className="card list">
          {party.members.map((m) => {
            const open = !!openP[m.id];
            const rows = personRows(party, sum, m.id);
            const nb = netBadge(sum.net[m.id]);
            return (
              <div key={m.id}>
                <button className="acc-btn" aria-expanded={open} onClick={() => setOpenP({ ...openP, [m.id]: !open })}>
                  <Avatar name={m.name} color={m.color} size="l" />
                  <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700 }}>{m.name}</span>
                    <span className="hint">
                      Tham gia {rows.length} hóa đơn · chịu {vnd(sum.owed[m.id])}
                    </span>
                  </span>
                  <span className={`badge ${nb.cls}`}>{nb.t}</span>
                  <span className={`chev ${open ? 'open' : ''}`}>
                    <Icon d={ICONS.chevron} />
                  </span>
                </button>
                {open && (
                  <div className="fade" style={{ padding: '0 16px 16px 72px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                    {rows.map((r) => (
                      <div key={r.id} className="kv" style={{ alignItems: 'center' }}>
                        <span className="row" style={{ gap: 6, color: 'var(--text2)' }}>
                          {r.name}
                          {r.spLabel && <span className="badge b-gift">{r.spLabel}</span>}
                        </span>
                        <strong>{vnd(r.amt)}</strong>
                      </div>
                    ))}
                    <div className="divider" />
                    <div className="kv">
                      <span>Phần phải chịu</span>
                      <strong>{vnd(sum.owed[m.id])}</strong>
                    </div>
                    <div className="kv">
                      <span>Đã ứng trước</span>
                      <strong>{vnd(sum.paidUp[m.id])}</strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <h2>Từng hóa đơn</h2>
        {party.bills.map((b) => {
          const c = sum.calcs[b.id];
          const open = !!openB[b.id];
          const spText = sponsorText(party, b, sum);
          return (
            <div key={b.id} className="card" style={{ overflow: 'hidden' }}>
              <button className="acc-btn" aria-expanded={open} onClick={() => setOpenB({ ...openB, [b.id]: !open })}>
                <span className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 700 }}>{b.name}</span>
                  <span className="hint">
                    {W.name(b.payer || '')} trả trước · {c.parts.length} người
                  </span>
                </span>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{vnd(b.amount)}</span>
                <span className={`chev ${open ? 'open' : ''}`}>
                  <Icon d={ICONS.chevron} />
                </span>
              </button>
              {open && (
                <div className="fade" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {spText && (
                    <span className="badge b-gift" style={{ alignSelf: 'flex-start' }}>
                      <Icon d={ICONS.gift} size={14} stroke={2.2} />
                      {spText}
                    </span>
                  )}
                  {Object.keys(c.total).map((id) => (
                    <div key={id} className="row" style={{ gap: 10, fontSize: 14 }}>
                      <Avatar name={W.name(id)} color={W.color(id)} size="s" />
                      <span className="grow" style={{ color: 'var(--text2)' }}>
                        {W.name(id)}
                      </span>
                      <strong>{vnd(c.total[id])}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}

/* ================= 5. QR ================= */
function BankCard({ party, sum, id, update, onImage }: { party: Party; sum: Summary; id: string; update: Update; onImage: (id: string, f: File) => void }) {
  const toast = useToast();
  const W = who(party);
  const bk = party.bank[id] || emptyBank();
  const incoming = sum.txs.filter((t) => t.to === id);
  const total = incoming.reduce((a, t) => a + t.amt, 0);
  const first = incoming[0];
  const autoOk = !!bk.bin && bk.acc.length >= 6;
  const set = (patch: Partial<BankInfo>) =>
    update((p) => {
      p.bank[id] = { ...emptyBank(), ...(p.bank[id] || {}), ...patch };
    });
  const isOrg = sum.hub && id === sum.org;
  const name = W.name(id);
  const acctLine = autoOk ? `${bankName(bk.bin)} · ${bk.acc}` : '';
  // What copy/download exports: the uploaded screenshot, or a reusable VietQR without a fixed amount.
  const exportSrc: QrImageSource | null =
    bk.mode === 'upload' && bk.qr
      ? { imageUrl: bk.qr, caption: [name, ...(acctLine ? [acctLine] : [])] }
      : bk.mode === 'auto' && autoOk
        ? { payload: vietqrPayload(bk.bin, bk.acc), caption: [name, acctLine] }
        : null;
  const fileName = `QR-${ascii(name).replace(/\s+/g, '-')}.png`;
  const pasteFromClipboard = async () => {
    const f = await readClipboardImage();
    if (f === 'unsupported') toast('Trình duyệt chưa cho đọc clipboard. Hãy nhấn Ctrl+V (hoặc giữ để Dán) ngay trên trang này.');
    else if (!f) toast('Clipboard chưa có ảnh. Hãy chụp hoặc sao chép ảnh QR trước nhé.');
    else onImage(id, f);
  };

  return (
    <div
      className="card"
      data-qr-card={id}
      style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}
      onPaste={(e) => {
        const f = imageFromPaste(e);
        if (!f) return;
        e.preventDefault();
        onImage(id, f);
      }}
    >
      <div className="row">
        <Avatar name={W.name(id)} color={W.color(id)} size="l" />
        <div className="grow">
          <div className="row" style={{ gap: 8, fontWeight: 700 }}>
            {W.name(id)}
            {isOrg && <span className="badge b-pos">Người tổ chức</span>}
          </div>
          <div className="hint">
            Sẽ nhận {vnd(total)} từ {joinNames(incoming.map((t) => W.name(t.from)))}
          </div>
        </div>
      </div>
      <Seg<'upload' | 'auto'>
        label={`Cách thêm mã QR cho ${W.name(id)}`}
        value={bk.mode}
        options={[
          { k: 'upload', label: 'Ảnh QR có sẵn' },
          { k: 'auto', label: 'Tạo VietQR' },
        ]}
        onChange={(k) => set({ mode: k })}
      />
      {bk.mode === 'upload' &&
        (bk.qr ? (
          <div className="row" style={{ gap: 16 }}>
            <img src={bk.qr} alt={`Mã QR của ${W.name(id)}`} style={{ width: 128, height: 128, objectFit: 'contain', borderRadius: 12, background: '#fff', border: '1px solid var(--line)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
              <label className="btn btn-o btn-s" style={{ position: 'relative' }}>
                Đổi ảnh
                <QrUpload onDone={(url) => set({ qr: url })} label={`Đổi ảnh QR của ${W.name(id)}`} />
              </label>
              <button className="lnk" onClick={pasteFromClipboard}>
                Dán ảnh khác
              </button>
              <button className="lnk" style={{ color: 'var(--danger)' }} onClick={() => set({ qr: null })}>
                Xóa ảnh
              </button>
            </div>
          </div>
        ) : (
          <label className="drop">
            <span style={{ color: 'var(--sel-text)' }}>
              <Icon d={ICONS.camera} size={28} stroke={1.8} />
            </span>
            <span style={{ fontWeight: 700 }}>Tải ảnh QR lên</span>
            <span className="hint">Ảnh chụp VietQR, MoMo hoặc ZaloPay · tối đa 2MB, tự nén</span>
            <QrUpload
              onDone={(url, kb) => {
                set({ qr: url });
                toast(`Đã lưu mã QR (${kb}KB)`);
              }}
              label={`Tải ảnh QR của ${W.name(id)}`}
            />
          </label>
        ))}
      {bk.mode === 'upload' && !bk.qr && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-o btn-s" onClick={pasteFromClipboard}>
            <Icon d={ICONS.copy} size={18} />
            Dán ảnh từ clipboard
          </button>
          <span className="hint">hoặc nhấn Ctrl+V</span>
        </div>
      )}
      {bk.mode === 'auto' &&
        (autoOk && first ? (
          <div className="row" style={{ gap: 14 }}>
            <QrSvg size={128} text={vietqrPayload(bk.bin, bk.acc, first.amt, transferNote(W.name(first.from), W.name(id)))} label={`VietQR mẫu của ${W.name(id)}`} />
            <div className="hint">
              Mã tự điền đúng số tiền và nội dung cho từng người. Ví dụ: {W.name(first.from)} chuyển {vnd(first.amt)}, nội dung “{transferNote(W.name(first.from), W.name(id))}”.
            </div>
          </div>
        ) : (
          <div className="hint" style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg)', fontSize: 14 }}>
            Chọn ngân hàng và nhập số tài khoản bên dưới để tạo mã.
          </div>
        ))}
      {exportSrc && (
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn btn-o btn-s"
            style={{ flex: 1, padding: '0 8px' }}
            onClick={async () => {
              if (await copyQrImage(exportSrc)) toast('Đã sao chép mã QR');
              else {
                await downloadQrImage(exportSrc, fileName).catch(() => {});
                toast('Trình duyệt chưa hỗ trợ sao chép ảnh, đã tải mã QR về máy');
              }
            }}
          >
            <Icon d={ICONS.copy} size={18} />
            Sao chép mã QR
          </button>
          <button
            className="btn btn-o btn-s"
            style={{ flex: 1, padding: '0 8px' }}
            onClick={() =>
              downloadQrImage(exportSrc, fileName)
                .then(() => toast('Đã tải mã QR về máy'))
                .catch((e: Error) => toast(e.message))
            }
          >
            <Icon d={ICONS.download} size={18} />
            Tải mã QR
          </button>
        </div>
      )}
      <div className="field" style={{ gap: 6 }}>
        <label className="lbl" htmlFor={`bk-${id}`}>
          Ngân hàng
        </label>
        <select id={`bk-${id}`} className="inp" value={bk.bin} onChange={(e) => set({ bin: e.target.value })}>
          <option value="">Chọn ngân hàng</option>
          {BANKS.map((b) => (
            <option key={b.bin} value={b.bin}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ gap: 6 }}>
        <label className="lbl" htmlFor={`ac-${id}`}>
          Số tài khoản
        </label>
        <div className="row" style={{ gap: 8 }}>
          <input id={`ac-${id}`} className="inp grow" inputMode="numeric" autoComplete="off" placeholder="VD: 0123456789" value={bk.acc} onChange={(e) => set({ acc: e.target.value.replace(/[^0-9]/g, '').slice(0, 19) })} />
          <button
            className="btn btn-o btn-s"
            style={{ minHeight: 52 }}
            aria-label={`Sao chép số tài khoản của ${W.name(id)}`}
            onClick={async () => {
              if (!bk.acc) return toast('Chưa có số tài khoản');
              toast((await copyText(bk.acc)) ? 'Đã sao chép số tài khoản' : 'Không sao chép được');
            }}
          >
            <Icon d={ICONS.copy} size={18} />
            Chép
          </button>
        </div>
      </div>
      <div className="field" style={{ gap: 6 }}>
        <label className="lbl" htmlFor={`ho-${id}`}>
          Chủ tài khoản
        </label>
        <input id={`ho-${id}`} className="inp" autoComplete="off" placeholder="VD: NGUYEN VAN A" value={bk.holder} onChange={(e) => set({ holder: ascii(e.target.value).toUpperCase().slice(0, 40) })} />
      </div>
    </div>
  );
}

function QrUpload({ onDone, label }: { onDone: (url: string, kb: number) => void; label: string }) {
  const toast = useToast();
  return (
    <input
      type="file"
      accept="image/*"
      className="fi"
      aria-label={label}
      onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        if (f.size > 15 * 1024 * 1024) return toast('Ảnh quá lớn');
        try {
          const { url, kb } = await compressImage(f, 400 * 1024, 900);
          onDone(url, kb);
        } catch (err) {
          toast((err as Error).message);
        }
      }}
    />
  );
}

export function StepQr({ party, sum, update }: { party: Party; sum: Summary; update: Update }) {
  const toast = useToast();
  const W = who(party);
  const recv: string[] = [];
  sum.txs.forEach((t) => !recv.includes(t.to) && recv.push(t.to));
  if (sum.hub && sum.org && recv.includes(sum.org)) recv.sort((a, b) => (a === sum.org ? -1 : b === sum.org ? 1 : 0));

  const saveImage = async (id: string, f: File) => {
    if (f.size > 15 * 1024 * 1024) return toast('Ảnh quá lớn');
    try {
      const { url, kb } = await compressImage(f, 400 * 1024, 900);
      update((p) => {
        p.bank[id] = { ...emptyBank(), ...(p.bank[id] || {}), qr: url, mode: 'upload' };
      });
      toast(`Đã lưu mã QR của ${W.name(id)} (${kb}KB)`);
    } catch (err) {
      toast((err as Error).message);
    }
  };

  // Ctrl+V anywhere on this step (outside a card) goes to the first receiver — the organiser in hub mode.
  const first = recv[0];
  const saveRef = useRef(saveImage);
  saveRef.current = saveImage;
  useEffect(() => {
    if (!first) return;
    const h = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      const f = imageFromPaste(e);
      if (!f) return;
      e.preventDefault();
      saveRef.current(first, f);
    };
    window.addEventListener('paste', h);
    return () => window.removeEventListener('paste', h);
  }, [first]);
  const others = party.members.filter((m) => !recv.includes(m.id)).map((m) => m.name);
  const o = sum.org ? W.name(sum.org) : '';
  return (
    <>
      <p style={{ color: 'var(--text2)' }}>
        {sum.hub && sum.org
          ? `${o} là người thu tiền, nên chỉ cần mã QR của ${o} là mọi người quét và chuyển được ngay. Người được ${o} trả lại có thể thêm QR của mình.`
          : 'Người nhận tiền thêm mã QR ngân hàng hoặc ví, để mọi người quét là chuyển được ngay.'}
      </p>
      {recv.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>
          Không ai cần nhận tiền, nên chưa cần mã QR nào.
        </div>
      )}
      {recv.map((id) => (
        <BankCard key={id} party={party} sum={sum} id={id} update={update} onImage={saveImage} />
      ))}
      {recv.length > 0 && others.length > 0 && (
        <div className="hint" style={{ textAlign: 'center', fontSize: 14 }}>
          {joinNames(others)} không nhận tiền nên không cần thêm mã QR.
        </div>
      )}
    </>
  );
}

/* ================= 6. Share ================= */
export function StepShare({ id, editKey, party, sum, paid, onToggle }: { id: string; editKey: string; party: Party; sum: Summary; paid: PaidMap; onToggle: (k: string) => void }) {
  const toast = useToast();
  const pub = absoluteUrl(store.viewRoute(id, party));
  const edit = absoluteUrl(`/p/${id}/sua?k=${editKey}`);
  const paidCount = sum.txs.filter((t) => paid[txKey(t)]).length;
  const allPaid = sum.txs.length > 0 && paidCount === sum.txs.length;
  const copy = async (t: string, msg: string) => toast((await copyText(t)) ? msg : 'Không sao chép được, hãy chép tay');
  const share = async (where: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: party.name, text: `Xem số tiền cần trả cho “${party.name}”`, url: pub });
      } catch {
        /* cancelled */
      }
    } else copy(pub, `Đã sao chép link, dán vào ${where} nhé`);
  };
  const longLink = pub.length > 1800;

  return (
    <>
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div className="hint" style={{ fontSize: 14 }}>
          Link cho cả nhóm · chỉ xem và đánh dấu đã trả
        </div>
        {longLink ? <div className="hint">Link khá dài nên không tạo mã QR được. Hãy gửi link trực tiếp.</div> : <QrSvg text={pub} size={184} label="Mã QR của link chia sẻ" />}
        <div style={{ fontWeight: 600, fontSize: 14, overflowWrap: 'anywhere', maxHeight: 66, overflow: 'hidden' }}>{pub}</div>
        <button className="btn btn-p btn-block" onClick={() => copy(pub, 'Đã sao chép link')}>
          <Icon d={ICONS.copy} />
          Sao chép link
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, width: '100%' }}>
          <button className="btn btn-o btn-s" style={{ padding: '0 8px' }} onClick={() => share('Zalo')}>
            Zalo
          </button>
          <button className="btn btn-o btn-s" style={{ padding: '0 8px' }} onClick={() => share('Messenger')}>
            Messenger
          </button>
          <button className="btn btn-o btn-s" style={{ padding: '0 8px' }} onClick={() => share('ứng dụng bạn muốn')}>
            <Icon d={ICONS.share} size={18} />
            Khác
          </button>
        </div>
        {store.kind === 'local' && <div className="hint">Link chứa sẵn dữ liệu buổi tiệc. Nếu sửa hóa đơn, hãy gửi lại link mới.</div>}
      </div>
      <div className="card row" style={{ padding: '12px 8px 12px 16px' }}>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>Link quản lý</div>
          <div className="hint">Chỉ gửi cho người cùng sửa hóa đơn</div>
        </div>
        <button className="ibtn" aria-label="Sao chép link quản lý" onClick={() => copy(edit, 'Đã sao chép link quản lý')}>
          <Icon d={ICONS.copy} />
        </button>
      </div>
      <section className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <h2>Tình hình thanh toán</h2>
          <span className={`badge ${allPaid ? 'b-pos' : 'b-neu'}`}>
            {paidCount}/{sum.txs.length} khoản đã trả
          </span>
        </div>
        <div className="progress">
          <div style={{ width: `${sum.txs.length ? Math.round((paidCount * 100) / sum.txs.length) : 0}%` }} />
        </div>
        {store.kind === 'local' && <div className="hint">Không có máy chủ nên trạng thái chỉ lưu trên máy này. Bạn tự đánh dấu khi nhận được tiền.</div>}
        {allPaid && (
          <div className="card done-card">
            <Confetti />
            <span className="done-ic">
              <Icon d={ICONS.check} size={34} stroke={2.4} />
            </span>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Xong hết rồi!</div>
            <div style={{ fontSize: 14 }}>Mọi khoản đã được thanh toán. Cảm ơn cả nhóm nhé.</div>
          </div>
        )}
        {sum.txs.length > 0 && (
          <div className="card list">
            {sum.txs.map((t) => {
              const k = txKey(t);
              const on = !!paid[k];
              return (
                <TxRow
                  key={k}
                  p={party}
                  {...t}
                  right={
                    <button className={`pbtn ${on ? 'b-pos' : 'b-neg'}`} aria-pressed={on} onClick={() => onToggle(k)}>
                      {on ? 'Đã trả' : 'Chưa trả'}
                    </button>
                  }
                />
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

/* ================= Desktop aside ================= */
export function Aside({ party, sum, paid }: { party: Party; sum: Summary; paid: PaidMap }) {
  const W = who(party);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Từng người</div>
        {party.members.map((m) => {
          const nb = netBadge(sum.net[m.id]);
          return (
            <div key={m.id} className="row" style={{ gap: 10, minHeight: 40 }}>
              <Avatar name={m.name} color={m.color} />
              <span className="grow" style={{ fontWeight: 600 }}>
                {m.name}
              </span>
              <span className={`badge ${nb.cls}`}>{nb.t}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Chuyển khoản</div>
        <div className="hint">{txSubText(party, sum)}</div>
        {sum.txs.map((t) => (
          <div key={txKey(t)} className="row" style={{ gap: 8, minHeight: 40, fontSize: 14 }}>
            <Avatar name={W.name(t.from)} color={W.color(t.from)} size="s" />
            <span className="grow">
              {W.name(t.from)} → {W.name(t.to)}
            </span>
            <strong style={{ whiteSpace: 'nowrap', color: paid[txKey(t)] ? 'var(--pos)' : undefined }}>{vnd(t.amt)}</strong>
          </div>
        ))}
      </div>
    </>
  );
}
