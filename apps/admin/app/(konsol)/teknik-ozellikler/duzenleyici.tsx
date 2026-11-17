'use client';

import {
  aralikMetni,
  aralikOku,
  TEKNIK_ALANLARI,
  type TeknikAlan,
  type TeknikDuzeltme,
  type TeknikOzet,
} from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { tarih, yonetim } from '../../../lib/istemci';

interface ModelVerisi {
  id: string;
  ad: string;
  arac: string | null;
  kaynak: TeknikOzet | null;
  sonuc: TeknikOzet | null;
  duzeltmeler: {
    id: string;
    yillar: [number | null, number | null];
    degerler: TeknikDuzeltme;
    not: string | null;
    zaman: string;
  }[];
}

const oku = (o: TeknikOzet | null, a: TeknikAlan): string => {
  const v = (o as unknown as Record<string, unknown> | null)?.[a.key];
  if (!v) return '';
  if (a.tur === 'aralik') return aralikMetni(v as [number, number], a.basamak ?? 0);
  return (v as string[]).map((x) => a.secenekler?.find(([k]) => k === x)?.[1] ?? x).join(', ');
};

const yaz = (d: TeknikDuzeltme) =>
  Object.entries(d)
    .map(([k, v]) => {
      const a = TEKNIK_ALANLARI.find((x) => x.key === k);
      const deger =
        Array.isArray(v) && typeof v[0] === 'number'
          ? aralikMetni(v as [number, number], a?.basamak ?? 0)
          : (v as string[]).map((x) => a?.secenekler?.find(([s]) => s === x)?.[1] ?? x).join(', ');
      return `${a?.ad ?? k}: ${deger}${a?.birim && Array.isArray(v) && typeof v[0] === 'number' ? ` ${a.birim}` : ''}`;
    })
    .join(' · ');

/**
 * Bir motor sürümünün teknik değerlerini elle düzeltme ya da ekleme (sahip isteği, 17 Kasım 2026). Solda kaynaklardan
 * gelen değer, sağda yeni değer: yalnızca doldurulan alanlar kaydedilir ve kaynaktaki değerin yerine geçer. Yıl aralığı
 * boşsa bütün yıllar için geçerlidir. Etkin düzeltmeler aşağıda listelenir ve kaldırılabilir (kayıt silinmez).
 */
export function Duzenleyici({
  modelId,
  yillar,
  bildirim,
  bitti,
}: {
  modelId: string;
  yillar?: [number | null, number | null];
  /** Bir bildirimden gelindiyse kayıtla birlikte kapanır */
  bildirim?: string | null;
  bitti?: (mesaj: string) => void;
}) {
  const [yilBas, setYilBas] = useState(yillar?.[0] ? String(yillar[0]) : '');
  const [yilSon, setYilSon] = useState(yillar?.[1] ? String(yillar[1]) : '');
  const [veri, setVeri] = useState<ModelVerisi | null>(null);
  const [form, setForm] = useState<Record<string, string | string[]>>({});
  const [not, setNot] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(() => {
    const q = new URLSearchParams();
    if (/^\d{4}$/.test(yilBas)) q.set('yilBas', yilBas);
    if (/^\d{4}$/.test(yilSon)) q.set('yilSon', yilSon);
    yonetim<ModelVerisi>(`catalog/teknik/model/${modelId}?${q}`)
      .then(setVeri)
      .catch((e: Error) => setHata(e.message));
  }, [modelId, yilBas, yilSon]);
  useEffect(yukle, [yukle]);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setMesaj(null);
    const degerler: Record<string, [number, number] | string[]> = {};
    for (const a of TEKNIK_ALANLARI) {
      const v = form[a.key];
      if (v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length))
        continue;
      if (a.tur === 'aralik') {
        const r = aralikOku(v as string);
        if (!r) return setHata(`${a.ad}: sayı ya da "en az–en çok" yaz (ör. 150 ya da 150–170)`);
        degerler[a.key] = r;
      } else if (a.tur === 'liste') {
        degerler[a.key] = (v as string)
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
      } else degerler[a.key] = v as string[];
    }
    if (!Object.keys(degerler).length) return setHata('En az bir değer yaz');
    setMesgul(true);
    try {
      await yonetim(`catalog/teknik/model/${modelId}`, {
        method: 'POST',
        body: {
          yilBas: /^\d{4}$/.test(yilBas) ? Number(yilBas) : null,
          yilSon: /^\d{4}$/.test(yilSon) ? Number(yilSon) : null,
          degerler,
          not: not.trim() || null,
          bildirim: bildirim ?? null,
        },
      });
      setForm({});
      setNot('');
      const m = 'Düzeltme kaydedildi; talep sayfasında ve sihirbazda hemen görünür.';
      setMesaj(m);
      yukle();
      bitti?.(m);
    } catch (err) {
      setHata((err as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  async function kaldir(id: string) {
    if (!window.confirm('Düzeltme kaldırılsın mı? Kayıt silinmez; kaynaktaki değer yeniden gösterilir.'))
      return;
    setHata(null);
    try {
      await yonetim(`catalog/teknik/duzeltme/${id}/kaldir`, { method: 'POST', body: {} });
      setMesaj('Düzeltme kaldırıldı.');
      yukle();
    } catch (err) {
      setHata((err as Error).message);
    }
  }

  if (!veri) return <div className="k-panel k-empty">{hata ?? 'Yükleniyor…'}</div>;
  return (
    <section
      className="k-panel"
      style={{ padding: 16, marginBottom: 14 }}
      aria-label={`${veri.ad} teknik değerleri`}
    >
      <strong style={{ fontSize: 15.5 }}>
        {veri.arac} {veri.ad}
      </strong>
      <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#5A6073' }}>
        Yalnızca değiştirmek ya da eklemek istediğin alanı doldur; boş alan kaynaklardan (ADEME,
        vehicle-makes-models, TSB) gelmeye devam eder. Aralık için "150–170", liste için virgül kullan.
      </p>
      <form onSubmit={kaydet}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <label className="k-field" style={{ flex: '0 1 150px' }}>
            İlk yıl (boşsa hepsi)
            <input inputMode="numeric" value={yilBas} onChange={(e) => setYilBas(e.target.value)} />
          </label>
          <label className="k-field" style={{ flex: '0 1 150px' }}>
            Son yıl
            <input inputMode="numeric" value={yilSon} onChange={(e) => setYilSon(e.target.value)} />
          </label>
          <label className="k-field" style={{ flex: '1 1 260px' }}>
            Not (isteğe bağlı, kaynak ya da gerekçe)
            <input value={not} maxLength={500} onChange={(e) => setNot(e.target.value)} />
          </label>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#5A6073', fontSize: 12 }}>
                <th style={{ padding: '6px 8px' }}>Alan</th>
                <th style={{ padding: '6px 8px' }}>Şu an gösterilen</th>
                <th style={{ padding: '6px 8px' }}>Kaynaktaki</th>
                <th style={{ padding: '6px 8px', minWidth: 220 }}>Yeni değer</th>
              </tr>
            </thead>
            <tbody>
              {TEKNIK_ALANLARI.map((a) => {
                const simdi = oku(veri.sonuc, a);
                const kaynak = oku(veri.kaynak, a);
                return (
                  <tr key={a.key} style={{ borderTop: '1px solid #EEF0F5' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700 }}>
                      {a.ad}
                      {a.birim ? (
                        <span style={{ color: '#5A6073', fontWeight: 400 }}> ({a.birim})</span>
                      ) : null}
                    </td>
                    <td style={{ padding: '6px 8px', color: simdi !== kaynak ? '#2B4FB8' : undefined }}>
                      {simdi || '—'}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#5A6073' }}>{kaynak || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>
                      {a.tur === 'secim' ? (
                        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {a.secenekler?.map(([v, ad]) => {
                            const secili = ((form[a.key] as string[] | undefined) ?? []).includes(v);
                            return (
                              <label
                                key={v}
                                style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={secili}
                                  onChange={() =>
                                    setForm((f) => {
                                      const l = (f[a.key] as string[] | undefined) ?? [];
                                      return { ...f, [a.key]: secili ? l.filter((x) => x !== v) : [...l, v] };
                                    })
                                  }
                                />
                                {ad}
                              </label>
                            );
                          })}
                        </span>
                      ) : (
                        <input
                          aria-label={`${a.ad} yeni değer`}
                          value={(form[a.key] as string | undefined) ?? ''}
                          placeholder={a.ipucu ?? (a.tur === 'aralik' ? 'ör. 150 ya da 150–170' : '')}
                          onChange={(e) => setForm((f) => ({ ...f, [a.key]: e.target.value }))}
                          style={{
                            width: '100%',
                            border: '1px solid #D5DAE5',
                            borderRadius: 8,
                            padding: '7px 9px',
                            font: 'inherit',
                            fontSize: 13.5,
                          }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {hata ? (
          <p className="k-error" role="alert" style={{ marginTop: 12 }}>
            {hata}
          </p>
        ) : null}
        {mesaj ? (
          <p className="k-ok" role="status" style={{ marginTop: 12 }}>
            {mesaj}
          </p>
        ) : null}
        <button type="submit" className="k-btn-ok" disabled={mesgul} style={{ marginTop: 12 }}>
          {mesgul ? 'Kaydediliyor…' : bildirim ? 'Kaydet ve bildirimi kapat' : 'Düzeltmeyi kaydet'}
        </button>
      </form>

      <h3 style={{ fontSize: 14, margin: '20px 0 8px' }}>Etkin düzeltmeler</h3>
      {veri.duzeltmeler.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: '#5A6073' }}>Bu sürümde elle düzeltme yok.</p>
      ) : (
        veri.duzeltmeler.map((d) => (
          <div
            key={d.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 0',
              borderTop: '1px solid #EEF0F5',
              fontSize: 13,
            }}
          >
            <span>
              <strong>
                {d.yillar[0] || d.yillar[1] ? `${d.yillar[0] ?? '…'}–${d.yillar[1] ?? '…'}` : 'Bütün yıllar'}
              </strong>{' '}
              · {yaz(d.degerler)}
              {d.not ? <span style={{ color: '#5A6073' }}> · {d.not}</span> : null}
              <span style={{ color: '#5A6073' }}> · {tarih(d.zaman)}</span>
            </span>
            <button
              type="button"
              className="k-btn-line"
              style={{ fontSize: 13, padding: '5px 10px', color: '#A3271F' }}
              onClick={() => kaldir(d.id)}
            >
              Kaldır
            </button>
          </div>
        ))
      )}
    </section>
  );
}
