import { useEffect, useState } from 'react';
import { Avatar, Icon, ICONS, MoneyInput, Seg, useToast } from '../components/ui';
import { calcBill } from '../lib/calc';
import { joinNames, num, r1k, uid, vnd } from '../lib/format';
import { compressImage } from '../lib/image';
import type { Bill, Party, SplitMode, SponsorType } from '../lib/types';
import type { EditorState } from './Organizer';

const QUICK = ['Lẩu', 'Nướng', 'Karaoke', 'Taxi', 'Cà phê', 'Khách sạn'];

export function newBill(p: Party): Bill {
  return {
    id: uid('b'),
    name: '',
    amount: 0,
    payer: p.organiser && p.members.some((m) => m.id === p.organiser) ? p.organiser : p.members[0]?.id ?? null,
    parts: p.members.map((m) => m.id),
    split: 'equal',
    custom: {},
    sponsorOn: false,
    sponsors: [],
    sponsorType: 'full',
    sponsorAmount: 0,
    note: '',
    photo: null,
  };
}

interface Props {
  party: Party;
  state: EditorState;
  onChange: (s: EditorState) => void;
  onClose: () => void;
  onSave: (b: Bill) => void;
}

export default function BillEditor({ party, state, onChange, onClose, onSave }: Props) {
  const toast = useToast();
  const [tried, setTried] = useState(false);
  const d = state.d;
  const ids = party.members.map((m) => m.id);
  const c = calcBill(d, ids);
  const nameOf = (id: string) => party.members.find((m) => m.id === id)?.name ?? '?';
  const colorOf = (id: string) => party.members.find((m) => m.id === id)?.color ?? '#41474e';

  const ed = (fn: (b: Bill) => void) => {
    const n = structuredClone(d);
    fn(n);
    onChange({ ...state, d: n });
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const prefill = (b: Bill, mode: SplitMode) => {
    const eq = calcBill({ ...b, split: 'equal' }, ids);
    b.custom = {};
    if (mode === 'amount') eq.parts.forEach((id) => (b.custom[id] = eq.sh[id] || 0));
    if (mode === 'percent' && eq.parts.length) {
      const base = Math.floor(100 / eq.parts.length);
      eq.parts.forEach((id, i) => (b.custom[id] = base + (i === 0 ? 100 - base * eq.parts.length : 0)));
    }
  };

  const save = () => {
    const b = structuredClone(d);
    if (!b.name.trim()) b.name = 'Hóa đơn ' + (party.bills.length + (state.isNew ? 1 : 0));
    if (!calcBill(b, ids).ok) {
      setTried(true);
      return;
    }
    if (!b.sponsorOn) b.sponsors = [];
    onSave(b);
  };

  const allOn = d.parts.length === ids.length;
  const isCustom = d.split !== 'equal' && c.parts.length > 0 && c.rem > 0;
  let remText = '';
  let remCls = 'b-neu';
  if (isCustom) {
    if (d.split === 'amount') {
      if (c.remaining === 0) [remText, remCls] = ['Đã khớp ' + vnd(c.rem), 'b-pos'];
      else if (c.remaining > 0) [remText, remCls] = ['Còn ' + vnd(c.remaining) + ' chưa chia', 'b-neg'];
      else [remText, remCls] = ['Vượt ' + vnd(-c.remaining), 'b-neg'];
    } else if (c.remaining === 0) [remText, remCls] = ['Đã đủ 100%', 'b-pos'];
    else if (c.remaining > 0) [remText, remCls] = [`Còn ${c.remaining}% chưa chia`, 'b-neg'];
    else [remText, remCls] = [`Vượt ${-c.remaining}%`, 'b-neg'];
  }
  const spNames = joinNames(c.sps.map(nameOf));
  let spPreview = '';
  if (d.sponsorOn && c.sps.length && d.amount > 0) {
    if (d.sponsorType === 'full') spPreview = `${spNames} bao trọn ${vnd(d.amount)}. Những người khác không phải trả.`;
    else if (c.spTotal > 0) spPreview = `${spNames} tài trợ ${vnd(c.spTotal)}, còn ${vnd(c.rem)} chia cho ${c.parts.length} người.`;
  }
  const prevIds = ids.filter((id) => c.total[id] != null);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="ed-t">
        <div className="sheet-hd">
          <h2 id="ed-t" className="grow">
            {state.isNew ? 'Thêm hóa đơn' : 'Sửa hóa đơn'}
          </h2>
          <button className="ibtn" aria-label="Đóng" onClick={onClose}>
            <Icon d={ICONS.close} size={22} />
          </button>
        </div>
        <div className="sheet-body">
          <div className="field">
            <label className="lbl" htmlFor="en">
              Tên hóa đơn
            </label>
            <input id="en" className="inp" value={d.name} maxLength={40} autoComplete="off" placeholder="VD: Lẩu, Karaoke, Taxi" onChange={(e) => ed((b) => void (b.name = e.target.value))} />
            <div className="chips" style={{ gap: 6 }}>
              {QUICK.map((q) => (
                <button key={q} className={`qchip ${d.name === q ? 'on' : ''}`} onClick={() => ed((b) => void (b.name = q))}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="lbl" htmlFor="ea">
              Số tiền
            </label>
            <MoneyInput id="ea" big value={d.amount} invalid={tried && !(d.amount > 0)} onChange={(n) => ed((b) => void (b.amount = n))} />
            <div className="chips" style={{ gap: 6 }}>
              {[50000, 100000, 200000, 500000].map((v) => (
                <button key={v} className="qchip" onClick={() => ed((b) => void (b.amount = (b.amount || 0) + v))}>
                  +{num(v)}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div>
              <div className="lbl" id="ep">
                Người trả
              </div>
              <div className="hint">Ai đã trả tiền trước?</div>
            </div>
            <div className="chips" role="radiogroup" aria-labelledby="ep">
              {party.members.map((m) => (
                <button key={m.id} role="radio" aria-checked={d.payer === m.id} className={`chip ${d.payer === m.id ? 'on' : ''}`} onClick={() => ed((b) => void (b.payer = m.id))}>
                  <Avatar name={m.name} color={m.color} />
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div className="lbl" id="epa">
                  Người tham gia · {d.parts.length}/{ids.length}
                </div>
                <div className="hint">Ai cùng dùng hóa đơn này?</div>
              </div>
              <button
                className="lnk"
                onClick={() =>
                  ed((b) => {
                    b.parts = allOn ? [] : ids.slice();
                    if (allOn) b.custom = {};
                  })
                }
              >
                {allOn ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>
            <div className="chips" role="group" aria-labelledby="epa">
              {party.members.map((m) => {
                const on = d.parts.includes(m.id);
                return (
                  <button
                    key={m.id}
                    aria-pressed={on}
                    className={`chip ${on ? 'on' : 'off'}`}
                    onClick={() =>
                      ed((b) => {
                        if (on) {
                          b.parts = b.parts.filter((p) => p !== m.id);
                          delete b.custom[m.id];
                        } else b.parts = ids.filter((p) => p === m.id || b.parts.includes(p));
                      })
                    }
                  >
                    <Avatar name={m.name} color={m.color} />
                    {m.name}
                    {on && <Icon d={ICONS.check} size={16} stroke={2.6} />}
                  </button>
                );
              })}
            </div>
            {c.parts.length === 0 && <div className="err-text">Chọn ít nhất 1 người tham gia.</div>}
          </div>

          <div className="field" style={{ gap: 10 }}>
            <div className="lbl">Chia kiểu</div>
            <Seg<SplitMode>
              label="Chia kiểu"
              value={d.split}
              options={[
                { k: 'equal', label: 'Chia đều' },
                { k: 'amount', label: 'Theo số tiền' },
                { k: 'percent', label: 'Theo %' },
              ]}
              onChange={(k) =>
                ed((b) => {
                  if (b.split !== k) {
                    b.split = k;
                    prefill(b, k);
                  }
                })
              }
            />
            {d.split === 'equal' && c.parts.length > 0 && c.rem > 0 && (
              <div className="hint" style={{ fontSize: 14 }}>
                Mỗi người khoảng {vnd(r1k(c.rem / c.parts.length))}
                {c.spTotal ? ' (sau khi trừ tài trợ)' : ''}. Tiền lẻ do làm tròn tính cho người trả.
              </div>
            )}
            {isCustom && (
              <div className="card" style={{ padding: '8px 12px 12px 16px', display: 'flex', flexDirection: 'column' }}>
                {c.parts.map((id) => {
                  const v = d.custom[id];
                  return (
                    <div key={id} className="row" style={{ gap: 10, minHeight: 56 }}>
                      <Avatar name={nameOf(id)} color={colorOf(id)} />
                      <label htmlFor={`cu-${id}`} className="grow" style={{ fontWeight: 600 }}>
                        {nameOf(id)}
                      </label>
                      <div className="money" style={{ width: 150 }}>
                        <input
                          id={`cu-${id}`}
                          className="inp"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="0"
                          style={{ minHeight: 44, textAlign: 'right', paddingRight: 32 }}
                          value={v ? (d.split === 'percent' ? String(v) : num(v)) : ''}
                          onChange={(e) => {
                            let n = parseInt(e.target.value.replace(/\D/g, '').slice(0, 12) || '0', 10);
                            if (d.split === 'percent') n = Math.min(100, n);
                            ed((b) => void (b.custom[id] = n));
                          }}
                        />
                        <span aria-hidden="true" style={{ right: 12 }}>
                          {d.split === 'percent' ? '%' : 'đ'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="row" style={{ justifyContent: 'flex-end', paddingTop: 6 }}>
                  <span className={`badge ${remCls}`} aria-live="polite">
                    {remText}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="stack" style={{ gap: 12 }}>
            <button
              type="button"
              role="switch"
              aria-checked={d.sponsorOn}
              className="switch-row"
              onClick={() =>
                ed((b) => {
                  b.sponsorOn = !b.sponsorOn;
                  if (b.sponsorOn && !b.sponsors.length && ids[0]) b.sponsors = [ids[0]];
                })
              }
            >
              <span className="empty-ic" style={{ width: 40, height: 40, background: 'var(--warn-bg)', color: 'var(--warn)' }}>
                <Icon d={ICONS.gift} />
              </span>
              <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700 }}>
                  Tài trợ <span style={{ fontWeight: 400, color: 'var(--text3)' }}>· không bắt buộc</span>
                </span>
                <span className="hint">Bật nếu có người bao trọn hoặc góp một khoản</span>
              </span>
              <span className={`trk ${d.sponsorOn ? 'on' : ''}`} aria-hidden="true">
                <span />
              </span>
            </button>
            {d.sponsorOn && (
              <div className="card fade" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <div className="lbl" id="esp">
                    Ai tài trợ?
                  </div>
                  <div className="chips" role="group" aria-labelledby="esp">
                    {party.members.map((m) => {
                      const on = d.sponsors.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          aria-pressed={on}
                          className={`chip ${on ? 'on' : 'off'}`}
                          onClick={() => ed((b) => void (b.sponsors = on ? b.sponsors.filter((p) => p !== m.id) : ids.filter((p) => p === m.id || b.sponsors.includes(p))))}
                        >
                          <Avatar name={m.name} color={m.color} />
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Seg<SponsorType>
                  label="Kiểu tài trợ"
                  value={d.sponsorType}
                  options={[
                    { k: 'full', label: 'Bao trọn' },
                    { k: 'fixed', label: 'Tài trợ một phần' },
                  ]}
                  onChange={(k) => ed((b) => void (b.sponsorType = k))}
                />
                {d.sponsorType === 'fixed' && (
                  <div className="field" style={{ gap: 6 }}>
                    <label className="lbl" htmlFor="esa">
                      {c.sps.length > 1 ? 'Mỗi người tài trợ' : 'Số tiền tài trợ'}
                    </label>
                    <MoneyInput id="esa" value={d.sponsorAmount} placeholder="VD: 500.000" onChange={(n) => ed((b) => void (b.sponsorAmount = n))} />
                  </div>
                )}
                {spPreview && <div style={{ fontSize: 14, color: 'var(--warn)', background: 'var(--warn-bg)', padding: '10px 12px', borderRadius: 12 }}>{spPreview}</div>}
              </div>
            )}
          </div>

          <div className="field">
            <label className="lbl" htmlFor="eno">
              Ghi chú (không bắt buộc)
            </label>
            <textarea id="eno" className="inp" value={d.note} maxLength={200} placeholder="VD: Quán Bà Tư, tối thứ Bảy" onChange={(e) => ed((b) => void (b.note = e.target.value))} />
            {d.photo ? (
              <div className="row">
                <img src={d.photo} alt="Ảnh hóa đơn" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line)' }} />
                <button className="lnk" style={{ color: 'var(--danger)' }} onClick={() => ed((b) => void (b.photo = null))}>
                  Xóa ảnh
                </button>
              </div>
            ) : (
              <label className="btn btn-o btn-s" style={{ position: 'relative', alignSelf: 'flex-start' }}>
                <Icon d={ICONS.camera} size={18} />
                Thêm ảnh hóa đơn
                <input
                  type="file"
                  accept="image/*"
                  className="fi"
                  aria-label="Thêm ảnh hóa đơn"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    try {
                      const { url, kb } = await compressImage(f, 600 * 1024, 1000);
                      ed((b) => void (b.photo = url));
                      toast(`Đã đính kèm ảnh (${kb}KB)`);
                    } catch (err) {
                      toast((err as Error).message);
                    }
                  }}
                />
              </label>
            )}
          </div>

          {d.amount > 0 && prevIds.length > 0 && (
            <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Mỗi người trả</div>
              {prevIds.map((id) => {
                const spv = c.sp[id] || 0;
                return (
                  <div key={id} className="row" style={{ gap: 10, fontSize: 14 }}>
                    <Avatar name={nameOf(id)} color={colorOf(id)} size="s" />
                    <span className="grow row" style={{ gap: 6, color: 'var(--text2)' }}>
                      {nameOf(id)}
                      {spv > 0 && <span className="badge b-gift">{d.sponsorType === 'full' ? 'bao trọn' : 'tài trợ ' + vnd(spv)}</span>}
                    </span>
                    <strong>{vnd(c.total[id])}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="bottom">
          {tried && c.errs.length > 0 && (
            <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {c.errs.map((e) => (
                <span key={e} className="err-text">
                  {e}
                </span>
              ))}
            </div>
          )}
          <button className="btn btn-p btn-block" onClick={save}>
            {state.isNew ? 'Lưu hóa đơn' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </>
  );
}
