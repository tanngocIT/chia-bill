import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../App';
import { Avatar, ConfirmDialog, Cover, Icon, ICONS, ThemeButton, useToast } from '../components/ui';
import { rememberMine, store, type Watcher } from '../data';
import { summarize, txKey } from '../lib/calc';
import { dateVi, vnd } from '../lib/format';
import type { Bill, PaidMap, Party } from '../lib/types';
import BillEditor, { newBill } from './BillEditor';
import { Aside, StepBills, StepMembers, StepParty, StepQr, StepShare, StepSummary } from './steps';

export const STEPS = ['Buổi tiệc', 'Thành viên', 'Hóa đơn', 'Tổng kết', 'Mã QR', 'Chia sẻ'];
export const TITLES = ['Tạo buổi tiệc', 'Thêm thành viên', 'Thêm hóa đơn', 'Tổng kết', 'Mã QR thanh toán', 'Chia sẻ'];

export type Update = (fn: (p: Party) => void) => void;

export interface EditorState {
  isNew: boolean;
  d: Bill;
}

export default function Organizer({ id, editKey }: { id: string; editKey: string }) {
  const toast = useToast();
  const [party, setParty] = useState<Party | null>(null);
  const [paid, setPaid] = useState<PaidMap>({});
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [partyTried, setPartyTried] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = useRef(false);
  const watcher = useRef<Watcher | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  // load
  useEffect(() => {
    let alive = true;
    store
      .load(id)
      .then((snap) => {
        if (!alive) return;
        if (!snap) {
          setError('Không tìm thấy buổi tiệc này. Có thể link đã sai hoặc dữ liệu nằm trên máy khác.');
          return;
        }
        setParty(snap.party);
        setPaid(snap.paid);
        setStep(snap.party.bills.length ? 3 : snap.party.members.length ? 2 : 0);
        rememberMine({ id, key: editKey, name: snap.party.name, date: snap.party.date, kind: store.kind, updatedAt: Date.now() });
      })
      .catch((e: Error) => alive && setError(e.message));
    const w = store.watch(id, () => {
      store.load(id).then((snap) => {
        if (!snap) return;
        setPaid(snap.paid);
        if (!dirty.current) setParty(snap.party);
      });
    });
    watcher.current = w;
    return () => {
      alive = false;
      w.stop();
    };
  }, [id, editKey]);

  // debounced autosave
  useEffect(() => {
    if (!party || !dirty.current) return;
    setSaveState('saving');
    const t = window.setTimeout(() => {
      store
        .save(id, editKey, party)
        .then(() => {
          dirty.current = false;
          setSaveState('saved');
          watcher.current?.ping();
          rememberMine({ id, key: editKey, name: party.name, date: party.date, kind: store.kind, updatedAt: Date.now() });
        })
        .catch((e: Error) => {
          setSaveState('error');
          toast(e.message || 'Chưa lưu được, thử lại sau');
        });
    }, 700);
    return () => window.clearTimeout(t);
  }, [party, id, editKey, toast]);

  const update: Update = useCallback((fn) => {
    dirty.current = true;
    setParty((p) => {
      if (!p) return p;
      const n = structuredClone(p);
      fn(n);
      return n;
    });
  }, []);

  const sum = useMemo(() => (party ? summarize(party) : null), [party]);

  const go = (n: number) => {
    if (n > 0 && party && !party.name.trim()) {
      setPartyTried(true);
      setStep(0);
      return;
    }
    setStep(n);
    mainRef.current?.scrollTo({ top: 0 });
  };

  const togglePaid = async (key: string) => {
    if (!sum) return;
    const next = { ...paid, [key]: !paid[key] };
    setPaid(next);
    try {
      await store.setPaid(id, key, next[key]);
      watcher.current?.ping();
      const done = sum.txs.every((t) => next[txKey(t)]);
      toast(done ? 'Tất cả đã thanh toán xong!' : next[key] ? 'Đã đánh dấu đã trả' : 'Đã bỏ đánh dấu');
    } catch (e) {
      setPaid(paid);
      toast((e as Error).message);
    }
  };

  const doRemove = (mid: string) => {
    const name = party?.members.find((m) => m.id === mid)?.name || '';
    update((p) => {
      p.members = p.members.filter((m) => m.id !== mid);
      p.bills.forEach((b) => {
        b.parts = b.parts.filter((x) => x !== mid);
        b.sponsors = b.sponsors.filter((x) => x !== mid);
        delete b.custom[mid];
        if (b.payer === mid) b.payer = b.parts[0] || p.members[0]?.id || null;
        if (!b.sponsors.length) b.sponsorOn = false;
      });
      delete p.bank[mid];
      if (p.organiser === mid) p.organiser = p.members[0]?.id || null;
    });
    setConfirm(null);
    toast('Đã xóa ' + name);
  };

  const askRemove = (mid: string) => {
    if (!party) return;
    const used = party.bills.some((b) => b.parts.includes(mid) || b.payer === mid || (b.sponsorOn && b.sponsors.includes(mid)));
    if (used) setConfirm(mid);
    else doRemove(mid);
  };

  if (error)
    return (
      <div className="shell home">
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
      <div className="shell home">
        <main className="mn">
          <div className="page hint" style={{ textAlign: 'center', paddingTop: 80 }}>
            Đang tải…
          </div>
        </main>
      </div>
    );

  const org = sum.org;
  const orgM = party.members.find((m) => m.id === org);
  const nextDisabled = (step === 1 && party.members.length < 2) || (step === 2 && party.bills.length === 0);
  const nextLabel = step === 3 ? 'Thêm mã QR' : step === 4 ? 'Chia sẻ' : 'Tiếp tục';
  const openNew = () => {
    if (!party.members.length) {
      toast('Thêm thành viên trước nhé');
      return;
    }
    setEditor({ isNew: true, d: newBill(party) });
  };
  const confirmMember = confirm ? party.members.find((m) => m.id === confirm) : null;
  const confirmUsed = confirm ? party.bills.filter((b) => b.parts.includes(confirm) || b.payer === confirm || b.sponsors.includes(confirm)) : [];
  const saveText = saveState === 'saving' ? 'Đang lưu…' : saveState === 'saved' ? 'Đã lưu' : saveState === 'error' ? 'Chưa lưu được' : '';

  return (
    <div className="shell org">
      <header className="hd">
        <div className="hd-top">
          {step > 0 ? (
            <button className="ibtn" aria-label="Quay lại bước trước" onClick={() => go(step - 1)}>
              <Icon d={ICONS.back} size={22} />
            </button>
          ) : (
            <a className="ibtn" aria-label="Về trang chủ" href="#/">
              <Icon d={ICONS.home} size={22} />
            </a>
          )}
          <div className="hd-title">
            <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text3)', fontWeight: 600 }}>
              Bước {step + 1}/6 {saveText && '· ' + saveText}
            </div>
            <div style={{ fontSize: 17, lineHeight: '24px', fontWeight: 700 }}>{TITLES[step]}</div>
          </div>
          <ThemeButton />
        </div>
        <nav className="steps-m" aria-label="Các bước">
          {STEPS.map((s, i) => (
            <button key={s} className={`stp ${i === step ? 'on' : i < step ? 'done' : ''}`} aria-current={i === step ? 'step' : undefined} aria-label={`Bước ${i + 1}: ${TITLES[i]}`} onClick={() => go(i)}>
              <span className="bar" />
              <span className="t">{s}</span>
            </button>
          ))}
        </nav>
        <div className="side">
          <a href="#/" className="row" style={{ padding: '0 8px', color: 'inherit', textDecoration: 'none' }}>
            <Cover icon={party.icon} color={party.color} />
            <div className="grow">
              <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{party.name || 'Buổi tiệc chưa có tên'}</div>
              <div className="hint">{dateVi(party.date)}</div>
            </div>
          </a>
          <nav aria-label="Các bước" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {TITLES.map((t, i) => (
              <button key={t} className={`dnav ${i === step ? 'on' : i < step ? 'done' : ''}`} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}>
                <span className="nb">{i < step ? <Icon d={ICONS.check} size={14} stroke={3} /> : i + 1}</span>
                {t}
              </button>
            ))}
          </nav>
          <div className="grow" />
          {orgM && (
            <div className="card" style={{ padding: 16, boxShadow: 'none', background: 'var(--bg)' }}>
              <div className="hint">Người tổ chức</div>
              <div className="row" style={{ gap: 8, fontWeight: 700 }}>
                <Avatar name={orgM.name} color={orgM.color} />
                {orgM.name}
              </div>
            </div>
          )}
          <div className="save-state" style={{ padding: '0 12px' }} aria-live="polite">
            {saveText}
          </div>
          <ThemeButton withLabel />
        </div>
      </header>

      <main className="mn" ref={mainRef}>
        <div className="d-only" style={{ flexDirection: 'column', gap: 4 }}>
          <div className="hint" style={{ fontWeight: 600 }}>
            Bước {step + 1}/6
          </div>
          <h1 style={{ fontSize: 28, lineHeight: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>{TITLES[step]}</h1>
        </div>
        {step === 0 && <StepParty party={party} update={update} tried={partyTried} />}
        {step === 1 && <StepMembers party={party} update={update} org={org} onRemove={askRemove} />}
        {step === 2 && (
          <StepBills
            party={party}
            sum={sum}
            update={update}
            onOpen={(b) => setEditor({ isNew: false, d: structuredClone(b) })}
            onDelete={(bid) => {
              const prev = party.bills;
              const b = prev.find((x) => x.id === bid);
              update((p) => {
                p.bills = p.bills.filter((x) => x.id !== bid);
              });
              toast(`Đã xóa “${b?.name}”`, () =>
                update((p) => {
                  p.bills = prev;
                }),
              );
            }}
          />
        )}
        {step === 3 && <StepSummary party={party} sum={sum} update={update} paid={paid} />}
        {step === 4 && <StepQr party={party} sum={sum} update={update} />}
        {step === 5 && <StepShare id={id} editKey={editKey} party={party} sum={sum} paid={paid} onToggle={togglePaid} />}
      </main>

      <div className="bottom">
        {step === 1 && party.members.length < 2 && (
          <div className="hint" style={{ textAlign: 'center' }}>
            Cần ít nhất 2 người để chia bill
          </div>
        )}
        {step === 0 && partyTried && !party.name.trim() && (
          <div className="err-text" style={{ textAlign: 'center' }}>
            Đặt tên cho buổi tiệc để tiếp tục nhé.
          </div>
        )}
        <div className="btns">
          {step === 2 && (
            <button className={`btn ${party.bills.length ? 'btn-o' : 'btn-p'}`} onClick={openNew}>
              <Icon d={ICONS.plus} stroke={2.2} />
              Thêm hóa đơn
            </button>
          )}
          {step < 5 && !(step === 2 && !party.bills.length) && (
            <button className="btn btn-p" disabled={nextDisabled} onClick={() => (step === 0 && !party.name.trim() ? setPartyTried(true) : go(step + 1))}>
              {nextLabel}
            </button>
          )}
          {step === 5 && (
            <button className="btn btn-p" onClick={() => navigate(store.viewRoute(id, party))}>
              <Icon d={ICONS.eye} />
              Xem trang người nhận link
            </button>
          )}
        </div>
      </div>

      <aside className="aside" aria-label="Tóm tắt">
        <div>
          <div className="hint" style={{ fontWeight: 600 }}>
            Tổng chi
          </div>
          <div style={{ fontSize: 28, lineHeight: '36px', fontWeight: 700 }}>{vnd(sum.grand)}</div>
          <div className="hint">
            {party.bills.length} hóa đơn · {party.members.length} người
          </div>
        </div>
        <Aside party={party} sum={sum} paid={paid} />
      </aside>

      {editor && (
        <BillEditor
          party={party}
          state={editor}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onToggleSponsorOnly={(mid) => {
            const m = party.members.find((x) => x.id === mid);
            update((p) => {
              const x = p.members.find((y) => y.id === mid);
              if (x) x.sponsorOnly = !x.sponsorOnly;
            });
            if (m) toast(m.sponsorOnly ? `${m.name} lại cùng chia tiền với mọi người` : `${m.name} chỉ tài trợ, không chia phần còn lại`);
          }}
          onSave={(d) => {
            update((p) => {
              if (editor.isNew) p.bills.push(d);
              else p.bills = p.bills.map((b) => (b.id === d.id ? d : b));
            });
            setEditor(null);
            toast(editor.isNew ? `Đã thêm “${d.name}”` : 'Đã lưu thay đổi');
          }}
        />
      )}
      {confirmMember && (
        <ConfirmDialog
          title={`Xóa ${confirmMember.name}?`}
          desc={`${confirmMember.name} đang có trong ${confirmUsed.length} hóa đơn (${confirmUsed.map((b) => b.name).join(', ')}). Xóa sẽ bỏ ${confirmMember.name} khỏi các hóa đơn này và tính lại tiền.`}
          okLabel="Vẫn xóa"
          onOk={() => doRemove(confirmMember.id)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
