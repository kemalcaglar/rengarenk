'use client';

import { BUILTIN_ROLES } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { once, tarih, yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface ApprovalRow {
  id: string;
  kind: string;
  kindName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  title: string;
  reason: string | null;
  rule: string;
  amountKurus: string | null;
  createdAt: string;
  expiresAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  canDecide: boolean;
  requester: { id: string; name: string; role: string };
  decider: { id: string; name: string } | null;
  result: { outcome: 'SUCCEEDED' | 'FAILED'; createdAt: string } | null;
}

/** Tür rozeti, rozet renkleri ve onay düğmesinin yazısı tasarımdaki onay kuyruğundan (YonetimEkip). */
const KIND: Record<string, { tur?: string; bg: string; fg: string; onay: string }> = {
  REFUND: { tur: 'İade önerisi', bg: '#FDECEC', fg: '#A3271F', onay: 'İadeyi onayla' },
  BULK_SEND: { bg: '#EEF3FF', fg: '#2450C8', onay: 'Gönderimi onayla' },
  COUPON: { bg: '#F3EFFF', fg: '#4B2FA6', onay: 'Kuponu onayla' },
  PERMANENT_BAN: { bg: '#FFF6DF', fg: '#7A5300', onay: 'Engellemeyi onayla' },
  PRICE_CHANGE: { bg: '#E7FAF0', fg: '#11683F', onay: 'Değişikliği onayla' },
  ACCOUNT_DELETE: { bg: '#FDECEC', fg: '#A3271F', onay: 'Silmeyi onayla' },
};

const SONUC: Record<Exclude<ApprovalRow['status'], 'PENDING'>, [string, string]> = {
  APPROVED: ['Onaylandı', '#11683F'],
  REJECTED: ['Reddedildi', '#A3271F'],
  EXPIRED: ['Süresi doldu', '#5A6073'],
  CANCELLED: ['Geri çekildi', '#5A6073'],
};

const ROL = Object.fromEntries(BUILTIN_ROLES.map((r) => [r.key, r.ad])) as Record<string, string>;

/** Tutar tasarımdaki gibi: "99 TL", "39,60 TL" */
const tl = (kurus: string) => {
  const n = Number(kurus) / 100;
  return `${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n)} TL`;
};

/** Gösterilecek geçmiş karar sayısı: bekleyenlerin altında son kararlar */
const GECMIS = 20;

/**
 * Onay kuyruğu (tasarım: YonetimEkip › Onay kuyruğu): tek liste. Önce onayını bekleyenler ve kendi açık
 * isteklerin, altında son kararlar. Karar verilen satırda yalnızca sonuç yazar.
 */
export default function Onaylar() {
  const { me, refresh } = useKonsol();
  const [rows, setRows] = useState<ApprovalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all(
      (['bekleyen', 'benim', 'gecmis'] as const).map((k) => yonetim<ApprovalRow[]>(`approvals?kapsam=${k}`)),
    )
      .then(([bekleyen, benim, gecmis]) => {
        const acik = [...bekleyen, ...benim.filter((o) => o.status === 'PENDING')];
        const gorulen = new Set<string>();
        const tek = (o: ApprovalRow) => !gorulen.has(o.id) && Boolean(gorulen.add(o.id));
        const kapali = [...benim.filter((o) => o.status !== 'PENDING'), ...gecmis]
          .filter(tek)
          .sort((a, b) => (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt))
          .slice(0, GECMIS);
        setRows([...acik.filter(tek).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), ...kapali]);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function decide(id: string, action: 'approve' | 'reject' | 'cancel') {
    setBusy(id);
    setError(null);
    try {
      await yonetim(`approvals/${id}/${action}`, {
        method: 'POST',
        body: action === 'cancel' ? undefined : {},
      });
      load();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const ikincil = {
    border: '1px solid #D5DAE5',
    background: '#FFFFFF',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 700,
    color: '#1E2333',
    cursor: 'pointer',
  } as const;

  return (
    <>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>Onay kuyruğu</h1>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#5A6073' }}>
        Dört göz kuralına bağlı işlemler.{' '}
        {me.role === 'OWNER'
          ? 'İadeleri yalnızca sen onaylayabilirsin.'
          : 'İadeleri yalnızca sahip onaylayabilir.'}
      </p>
      {error ? (
        <p className="k-error" role="alert">
          {error}
        </p>
      ) : null}
      {rows === null ? (
        <p className="muted">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <div className="k-panel k-empty">Onay bekleyen işlem yok.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((o) => {
            const k = KIND[o.kind] ?? { bg: '#F3F5FA', fg: '#3A4052', onay: 'Onayla' };
            const rol = ROL[o.requester.role];
            const geriCek = o.status === 'PENDING' && !o.canDecide && o.requester.id === me.id;
            return (
              <article
                key={o.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E3E6EF',
                  borderRadius: 18,
                  padding: '16px 18px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '10px 18px',
                }}
              >
                <span style={{ flex: '999 1 360px', minWidth: 0 }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: k.bg,
                        color: k.fg,
                      }}
                    >
                      {k.tur ?? o.kindName}
                    </span>
                    <span style={{ fontSize: 12.5, color: '#5A6073' }}>
                      {o.requester.id === me.id ? 'Sen' : o.requester.name}
                      {rol && o.requester.id !== me.id ? ` (${rol})` : ''} · {once(o.createdAt)}
                    </span>
                  </span>
                  <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, marginTop: 6 }}>
                    {o.title || `${o.kindName} isteği`}
                    {o.amountKurus ? ` · ${tl(o.amountKurus)}` : ''}
                  </span>
                  {o.reason ? (
                    <span style={{ display: 'block', fontSize: 13.5, color: '#3A4052', marginTop: 3 }}>
                      {o.reason}
                    </span>
                  ) : null}
                  <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 4 }}>
                    {o.rule}
                  </span>
                </span>
                {o.canDecide ? (
                  <span style={{ flex: 'none', display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      style={ikincil}
                      disabled={busy === o.id}
                      onClick={() => decide(o.id, 'reject')}
                    >
                      Reddet
                    </button>
                    <button
                      type="button"
                      style={{
                        border: 0,
                        background: '#3DD68C',
                        borderRadius: 10,
                        padding: '10px 16px',
                        fontSize: 14,
                        fontWeight: 800,
                        color: '#1E2333',
                        cursor: 'pointer',
                      }}
                      disabled={busy === o.id}
                      onClick={() => decide(o.id, 'approve')}
                    >
                      {k.onay}
                    </button>
                  </span>
                ) : geriCek ? (
                  <button
                    type="button"
                    style={ikincil}
                    title={o.expiresAt ? `Karar verilmezse ${tarih(o.expiresAt)} tarihinde düşer` : undefined}
                    disabled={busy === o.id}
                    onClick={() => decide(o.id, 'cancel')}
                  >
                    Geri çek
                  </button>
                ) : o.status !== 'PENDING' ? (
                  <span
                    style={{ flex: 'none', fontSize: 14, fontWeight: 800, color: SONUC[o.status][1] }}
                    title={
                      o.decider
                        ? `${o.decider.name} · ${tarih(o.decidedAt)}${o.decisionNote ? ` · ${o.decisionNote}` : ''}`
                        : undefined
                    }
                  >
                    {SONUC[o.status][0]}
                    {o.status === 'APPROVED' && o.result?.outcome === 'FAILED'
                      ? ' · yürütme yeniden denenecek'
                      : ''}
                  </span>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
