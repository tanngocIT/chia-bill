import { useState } from 'react';
import { navigate } from '../App';
import { Icon, ICONS, ThemeButton, useToast } from '../components/ui';
import { forgetMine, listMine, rememberMine, store } from '../data';
import { dateVi } from '../lib/format';
import { emptyParty, sampleParty } from '../lib/sample';
import type { Party } from '../lib/types';

export default function Home() {
  const toast = useToast();
  const [mine, setMine] = useState(listMine);
  const [busy, setBusy] = useState(false);

  const start = async (p: Party) => {
    setBusy(true);
    try {
      const { id, key } = await store.create(p);
      rememberMine({ id, key, name: p.name || 'Buổi tiệc mới', date: p.date, kind: store.kind, updatedAt: Date.now() });
      navigate(`/p/${id}/sua?k=${key}`);
    } catch (e) {
      toast((e as Error).message || 'Không tạo được buổi tiệc');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell home">
      <header className="hd" style={{ padding: '8px 8px 8px 16px' }}>
        <div className="hd-top">
          <span className="cover-ic" style={{ width: 36, height: 36, background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: 10 }}>
            <Icon d={ICONS.receipt} size={20} />
          </span>
          <div className="grow" style={{ fontWeight: 700, fontSize: 17, paddingLeft: 8 }}>
            Chia bill nhóm
          </div>
          <ThemeButton />
        </div>
      </header>
      <main className="mn">
        <div className="page stack">
          <div className="stack" style={{ gap: 8, paddingTop: 12 }}>
            <h1 style={{ fontSize: 30, lineHeight: '38px', fontWeight: 700, letterSpacing: '-0.01em' }}>Chia tiền buổi tiệc, gọn trong một link</h1>
            <p style={{ color: 'var(--text2)', fontSize: 16 }}>Thêm thành viên và hóa đơn, gửi link cho cả nhóm. Mọi người quét QR là trả xong.</p>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-p" disabled={busy} onClick={() => start(emptyParty())}>
              <Icon d={ICONS.plus} size={20} stroke={2.2} />
              Tạo buổi tiệc mới
            </button>
            <button className="btn btn-o" disabled={busy} onClick={() => start(sampleParty())}>
              Thử với dữ liệu mẫu
            </button>
          </div>
          {store.kind === 'local' && (
            <div className="card" style={{ padding: 16, background: 'var(--warn-bg)', color: 'var(--warn)', boxShadow: 'none', fontSize: 14 }}>
              Đang chạy không có máy chủ: dữ liệu lưu trên trình duyệt này, link chia sẻ chứa sẵn dữ liệu, và trạng thái “Đã trả” chỉ lưu trên từng máy.
            </div>
          )}
          <section className="stack" style={{ gap: 12 }}>
            <h2>Buổi tiệc của bạn</h2>
            {mine.length === 0 ? (
              <div className="card" style={{ padding: 20, color: 'var(--text2)', textAlign: 'center' }}>
                Chưa có buổi tiệc nào. Tạo buổi đầu tiên nhé!
              </div>
            ) : (
              <div className="card list">
                {mine.map((m) => (
                  <div key={m.id} className="li">
                    <a href={`#/p/${m.id}/sua?k=${m.key}`} className="grow" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', flexDirection: 'column', minHeight: 44, justifyContent: 'center' }}>
                      <span style={{ fontWeight: 700 }}>{m.name || 'Buổi tiệc chưa có tên'}</span>
                      <span className="hint">{dateVi(m.date)}</span>
                    </a>
                    <button
                      className="ibtn"
                      aria-label={`Ẩn ${m.name} khỏi danh sách`}
                      onClick={() => {
                        forgetMine(m.id);
                        setMine(listMine());
                      }}
                    >
                      <Icon d={ICONS.close} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
