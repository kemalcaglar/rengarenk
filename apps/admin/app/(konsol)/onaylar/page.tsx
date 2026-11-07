'use client';

import { useCallback, useEffect, useState } from 'react';
import { tarih, yonetim } from '../../../lib/istemci';
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

/** Tür rozet renkleri tasarımdaki onay kuyruğundan. */
const KIND_COLORS: Record<string, [string, string]> = {
  REFUND: ['#FDECEC', '#A3271F'],
  BULK_SEND: ['#EEF3FF', '#2450C8'],
  COUPON: ['#F3EFFF', '#4B2FA6'],
  PERMANENT_BAN: ['#FFF6DF', '#7A5300'],
  PRICE_CHANGE: ['#E7FAF0', '#11683F'],
  ACCOUNT_DELETE: ['#FDECEC', '#A3271F'],
};

const STATUS: Record<ApprovalRow['status'], [string, string]> = {
  PENDING: ['Bekliyor', '#7A5300'],
  APPROVED: ['Onaylandı', '#11683F'],
  REJECTED: ['Reddedildi', '#A3271F'],
  EXPIRED: ['Süresi doldu', '#5A6073'],
  CANCELLED: ['Geri çekildi', '#5A6073'],
};

const SCOPES = [
  ['bekleyen', 'Onayımı bekleyen'],
  ['benim', 'Benim isteklerim'],
  ['gecmis', 'Geçmiş kararlar'],
] as const;

const tl = (kurus: string) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(kurus) / 100);

/** Onay kuyruğu (tasarım: YonetimEkip › Onay kuyruğu). Dört göz kuralına bağlı işlemler. */
export default function Onaylar() {
  const { me, refresh } = useKonsol();
  const [scope, setScope] = useState<(typeof SCOPES)[number][0]>('bekleyen');
  const [rows, setRows] = useState<ApprovalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    yonetim<ApprovalRow[]>(`approvals?kapsam=${scope}`)
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, [scope]);
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

  return (
    <>
      <h1 className="k-h1">Onay kuyruğu</h1>
      <p className="k-sub" style={{ marginBottom: 16 }}>
        Dört göz kuralına bağlı işlemler. İsteyen kendi isteğini onaylayamaz; iadeleri yalnızca sahip onaylar.
      </p>
      <fieldset className="k-chips">
        <legend className="sr-only">Kapsam</legend>
        {SCOPES.map(([k, ad]) => (
          <button
            key={k}
            type="button"
            className="k-chip"
            aria-pressed={scope === k}
            onClick={() => setScope(k)}
          >
            {ad}
          </button>
        ))}
      </fieldset>
      {error ? (
        <p className="k-error" role="alert">
          {error}
        </p>
      ) : null}
      {rows === null ? (
        <p className="muted">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <div className="k-panel k-empty">
          {scope === 'bekleyen'
            ? me.approverOf.length === 0
              ? 'Rolün onay vermiyor; açtığın istekleri "Benim isteklerim"de izleyebilirsin.'
              : 'Onayını bekleyen istek yok.'
            : 'Kayıt yok.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((o) => {
            const [bg, fg] = KIND_COLORS[o.kind] ?? ['#F3F5FA', '#3A4052'];
            const [durum, durumRenk] = STATUS[o.status];
            return (
              <article
                key={o.id}
                className="k-panel"
                style={{
                  padding: '16px 18px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '10px 18px',
                }}
              >
                <span style={{ flex: '999 1 360px', minWidth: 0 }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px' }}>
                    <span className="k-pill" style={{ background: bg, color: fg }}>
                      {o.kindName}
                    </span>
                    <span style={{ fontSize: 12.5, color: '#5A6073' }}>
                      {o.requester.name} · {tarih(o.createdAt)}
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
                    {o.status === 'PENDING' && o.expiresAt ? ` Son karar: ${tarih(o.expiresAt)}.` : ''}
                  </span>
                  {o.decider ? (
                    <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 4 }}>
                      Karar: {o.decider.name} · {tarih(o.decidedAt)}
                      {o.decisionNote ? ` · “${o.decisionNote}”` : ''}
                      {o.result
                        ? ` · Yürütme: ${o.result.outcome === 'SUCCEEDED' ? 'tamam' : 'hata, yeniden denenecek'}`
                        : ''}
                    </span>
                  ) : null}
                </span>
                {o.canDecide ? (
                  <span style={{ flex: 'none', display: 'flex', gap: 8 }}>
                    <button
                      className="k-btn-line"
                      type="button"
                      disabled={busy === o.id}
                      onClick={() => decide(o.id, 'reject')}
                    >
                      Reddet
                    </button>
                    <button
                      className="k-btn-ok"
                      type="button"
                      disabled={busy === o.id}
                      onClick={() => decide(o.id, 'approve')}
                    >
                      Onayla
                    </button>
                  </span>
                ) : o.status === 'PENDING' && o.requester.id === me.id ? (
                  <button
                    className="k-btn-line"
                    type="button"
                    disabled={busy === o.id}
                    onClick={() => decide(o.id, 'cancel')}
                  >
                    Geri çek
                  </button>
                ) : (
                  <span style={{ flex: 'none', fontSize: 14, fontWeight: 800, color: durumRenk }}>
                    {durum}
                  </span>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
