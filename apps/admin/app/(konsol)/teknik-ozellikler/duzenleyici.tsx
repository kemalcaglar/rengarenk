'use client';

import {
  aralikMetni,
  aralikOku,
  type DonanimGrubu,
  donanimOku,
  donanimYaz,
  TEKNIK_ALANLARI,
  type TeknikAlan,
  type TeknikDuzeltme,
  type TeknikOzet,
  teknikMetniOku,
} from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { tarih, yonetim } from '../../../lib/istemci';

interface ModelVerisi {
  id: string;
  ad: string;
  arac: string | null;
  paketler: { id: string; ad: string; yillar: [number, number] | null }[];
  kaynak: TeknikOzet | null;
  sonuc: TeknikOzet | null;
  donanim: DonanimGrubu[] | null;
  duzeltmeler: {
    id: string;
    yillar: [number | null, number | null];
    paket: string | null;
    degerler: TeknikDuzeltme;
    donanim: DonanimGrubu[] | null;
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

const ogeSayisi = (g: readonly DonanimGrubu[] | null | undefined) =>
  (g ?? []).reduce((n, x) => n + x.ogeler.length, 0);

/** Okunan değerler → formdaki kutuların metni */
function formaYaz(d: TeknikDuzeltme): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const a of TEKNIK_ALANLARI) {
    const v = d[a.key];
    if (!v) continue;
    if (a.tur === 'aralik') out[a.key] = aralikMetni(v as [number, number], a.basamak ?? 0);
    else if (a.tur === 'secim') out[a.key] = v as string[];
    else out[a.key] = (v as string[]).join(', ');
  }
  return out;
}

const kutu = {
  width: '100%',
  border: '1px solid #D5DAE5',
  borderRadius: 8,
  padding: '7px 9px',
  font: 'inherit',
  fontSize: 13.5,
} as const;

/**
 * Bir motor sürümünün teknik değerlerini ve donanımını elle girme (sahip isteği, 17 ve 18 Kasım 2026). Üstteki kutuya
 * yapıştırılan metin (ör. "Motor Gücü<TAB>90 hp", "--Donanım--", "-Güvenlik-") okunur ve alanlar dolar; okunamayan
 * satırlar gösterilir, kaydetmeden önce her alan düzeltilebilir. Yalnızca doldurulan alanlar kaydedilir ve kaynaktaki
 * değerin yerine geçer. Yıl aralığı boşsa bütün yıllar; paket seçilirse kayıt (ve donanım) yalnızca o paketi seçen
 * talepte uygulanır. Etkin kayıtlar aşağıda listelenir ve kaldırılabilir (kayıt silinmez).
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
  const [paket, setPaket] = useState('');
  const [veri, setVeri] = useState<ModelVerisi | null>(null);
  const [form, setForm] = useState<Record<string, string | string[]>>({});
  const [metin, setMetin] = useState('');
  const [okunamayan, setOkunamayan] = useState<string[]>([]);
  const [donanimMetni, setDonanimMetni] = useState('');
  const [not, setNot] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(() => {
    const q = new URLSearchParams();
    if (/^\d{4}$/.test(yilBas)) q.set('yilBas', yilBas);
    if (/^\d{4}$/.test(yilSon)) q.set('yilSon', yilSon);
    if (paket) q.set('paket', paket);
    yonetim<ModelVerisi>(`catalog/teknik/model/${modelId}?${q}`)
      .then(setVeri)
      .catch((e: Error) => setHata(e.message));
  }, [modelId, yilBas, yilSon, paket]);
  useEffect(yukle, [yukle]);

  function metniOku() {
    setHata(null);
    const r = teknikMetniOku(metin);
    const alan = Object.keys(r.degerler).length;
    const oge = ogeSayisi(r.donanim);
    if (!alan && !oge && !r.yillar) {
      setOkunamayan(r.okunamayan);
      return setHata(
        'Metinden hiçbir değer okunamadı. Satırlar "Etiket<TAB>Değer" ya da "Etiket: Değer" olmalı.',
      );
    }
    setForm((f) => ({ ...f, ...formaYaz(r.degerler) }));
    if (r.yillar) {
      setYilBas(r.yillar[0] ? String(r.yillar[0]) : '');
      setYilSon(r.yillar[1] ? String(r.yillar[1]) : '');
    }
    if (oge) setDonanimMetni(donanimYaz(r.donanim));
    setOkunamayan(r.okunamayan);
    setMesaj(
      `${alan} alan${r.yillar ? ', yıl aralığı' : ''} ve ${oge} donanım öğesi dolduruldu. Kaydetmeden önce kontrol et.`,
    );
  }

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
    const donanim = donanimMetni.trim() ? donanimOku(donanimMetni) : [];
    if (!Object.keys(degerler).length && !donanim.length) return setHata('En az bir değer ya da donanım yaz');
    setMesgul(true);
    try {
      await yonetim(`catalog/teknik/model/${modelId}`, {
        method: 'POST',
        body: {
          yilBas: /^\d{4}$/.test(yilBas) ? Number(yilBas) : null,
          yilSon: /^\d{4}$/.test(yilSon) ? Number(yilSon) : null,
          paket: paket || null,
          degerler,
          donanim: donanim.length ? donanim : null,
          not: not.trim() || null,
          bildirim: bildirim ?? null,
        },
      });
      setForm({});
      setNot('');
      setMetin('');
      setDonanimMetni('');
      setOkunamayan([]);
      const m = 'Kaydedildi; talep sayfasında ve sihirbazda hemen görünür.';
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
    if (!window.confirm('Kayıt kaldırılsın mı? Kayıt silinmez; kaynaktaki değer yeniden gösterilir.')) return;
    setHata(null);
    try {
      await yonetim(`catalog/teknik/duzeltme/${id}/kaldir`, { method: 'POST', body: {} });
      setMesaj('Kayıt kaldırıldı.');
      yukle();
    } catch (err) {
      setHata((err as Error).message);
    }
  }

  if (!veri) return <div className="k-panel k-empty">{hata ?? 'Yükleniyor…'}</div>;
  const donanimOnizleme = donanimMetni.trim() ? donanimOku(donanimMetni) : [];
  return (
    <section
      className="k-panel"
      style={{ padding: 16, marginBottom: 14 }}
      aria-label={`${veri.ad} teknik değerleri ve donanımı`}
    >
      <strong style={{ fontSize: 15.5 }}>
        {veri.arac} {veri.ad}
      </strong>
      <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#5A6073' }}>
        Yalnızca değiştirmek ya da eklemek istediğin alanı doldur; boş alan kaynaklardan (ADEME,
        vehicle-makes-models, TSB) gelmeye devam eder. Aralık için "150–170", liste için virgül kullan.
      </p>

      <div style={{ background: '#F6F8FC', borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <label className="k-field" style={{ margin: 0 }}>
          Metinden doldur
          <textarea
            value={metin}
            rows={7}
            placeholder={
              '--Genel Bakış--\nMotor Gücü\t90 hp\nŞanzıman / Çekiş\tX-Tronic / Önden Çekiş\n…\n--Donanım--\n-Güvenlik-\nABS'
            }
            onChange={(e) => setMetin(e.target.value)}
            style={{ ...kutu, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5 }}
          />
        </label>
        <p style={{ margin: '6px 0 8px', fontSize: 12.5, color: '#5A6073' }}>
          Teknik özellik ve donanım metnini olduğu gibi yapıştır. Tanınan satırlar aşağıdaki alanlara, üretim
          yılı yıl aralığına, "--Donanım--" bölümü donanım kutusuna yazılır. Hiçbir şey kaydedilmez; kontrol
          edip kaydet.
        </p>
        <button type="button" className="k-btn-ok" disabled={!metin.trim()} onClick={metniOku}>
          Metni oku ve doldur
        </button>
        {okunamayan.length ? (
          <div style={{ marginTop: 10 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#7A5A00' }}>
              Okunamayan satırlar ({okunamayan.length}): gerekirse elle gir
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#5A6073' }}>
              {okunamayan.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <form onSubmit={kaydet}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <label className="k-field" style={{ flex: '0 1 130px' }}>
            İlk yıl (boşsa hepsi)
            <input inputMode="numeric" value={yilBas} onChange={(e) => setYilBas(e.target.value)} />
          </label>
          <label className="k-field" style={{ flex: '0 1 130px' }}>
            Son yıl (boşsa devam)
            <input inputMode="numeric" value={yilSon} onChange={(e) => setYilSon(e.target.value)} />
          </label>
          <label className="k-field" style={{ flex: '0 1 220px' }}>
            Paket
            <select value={paket} onChange={(e) => setPaket(e.target.value)}>
              <option value="">Bütün paketler</option>
              {veri.paketler.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ad}
                  {p.yillar ? ` (${p.yillar[0]}–${p.yillar[1]})` : ''}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: '#5A6073', fontWeight: 400 }}>
              {paket
                ? 'Kayıt yalnızca bu paketi seçen talepte uygulanır.'
                : 'Kayıt bu motorun bütün paketlerinde uygulanır.'}
            </span>
          </label>
          <label className="k-field" style={{ flex: '1 1 240px' }}>
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
                const yeni = form[a.key];
                const dolu = Array.isArray(yeni) ? yeni.length > 0 : !!yeni?.trim();
                return (
                  <tr
                    key={a.key}
                    style={{ borderTop: '1px solid #EEF0F5', background: dolu ? '#F2FBF6' : undefined }}
                  >
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
                          style={kutu}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
          <label className="k-field" style={{ flex: '1 1 320px', margin: 0 }}>
            Donanım
            {paket ? ` (${veri.paketler.find((p) => p.id === paket)?.ad} paketi)` : ' (bütün paketler)'}
            <textarea
              value={donanimMetni}
              rows={10}
              placeholder={'-Güvenlik-\nABS\nIsofix\n-Konfor-\nHız Sabitleme Sistemi'}
              onChange={(e) => setDonanimMetni(e.target.value)}
              style={{ ...kutu, fontSize: 13 }}
            />
            <span style={{ fontSize: 12, color: '#5A6073', fontWeight: 400 }}>
              Her grup "-Grup adı-" satırıyla başlar, altında her satır bir öğe. Kaydedilen liste bu paketin
              önceki listesinin yerine geçer.
            </span>
          </label>
          <div style={{ flex: '1 1 260px', fontSize: 13 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700 }}>
              {donanimOnizleme.length
                ? `Kaydedilecek: ${ogeSayisi(donanimOnizleme)} öğe, ${donanimOnizleme.length} grup`
                : `Şu an gösterilen: ${veri.donanim ? `${ogeSayisi(veri.donanim)} öğe` : 'donanım yok'}`}
            </p>
            {(donanimOnizleme.length ? donanimOnizleme : (veri.donanim ?? [])).map((g) => (
              <p key={g.ad} style={{ margin: '0 0 4px', color: '#5A6073' }}>
                <strong style={{ color: '#1B1F2A' }}>{g.ad}:</strong> {g.ogeler.join(', ')}
              </p>
            ))}
          </div>
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
          {mesgul ? 'Kaydediliyor…' : bildirim ? 'Kaydet ve bildirimi kapat' : 'Kaydet'}
        </button>
      </form>

      <h3 style={{ fontSize: 14, margin: '20px 0 8px' }}>Etkin kayıtlar</h3>
      {veri.duzeltmeler.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: '#5A6073' }}>Bu sürümde elle girilmiş kayıt yok.</p>
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
            <span style={{ flex: '1 1 400px' }}>
              <strong>
                {d.yillar[0] || d.yillar[1] ? `${d.yillar[0] ?? '…'}–${d.yillar[1] ?? '…'}` : 'Bütün yıllar'}
                {d.paket ? ` · ${d.paket} paketi` : ''}
              </strong>
              {Object.keys(d.degerler).length ? ` · ${yaz(d.degerler)}` : ''}
              {d.donanim?.length ? ` · Donanım: ${ogeSayisi(d.donanim)} öğe` : ''}
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
