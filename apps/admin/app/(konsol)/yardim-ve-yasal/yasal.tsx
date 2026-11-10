'use client';

import type { LegalDiffLine, LegalKey } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

interface Satir {
  key: LegalKey;
  ad: string;
  kullanim: string;
  yayinda: { version: number; tarih: string | null; onaylayan: number } | null;
  taslak: {
    version: number;
    material: boolean;
    not: string | null;
    onaylayan: number;
    onayda: boolean;
    guncelleme: string;
  } | null;
}

interface Detay {
  key: LegalKey;
  ad: string;
  surumler: { version: number; status: string; material: boolean; tarih: string }[];
  yayinda: { version: number; title: string; body: string } | null;
  taslak: {
    version: number;
    title: string;
    body: string;
    material: boolean;
    not: string | null;
    onayda: boolean;
    kilitli: boolean;
  } | null;
  fark: { eski: number | null; yeni: number | null; satirlar: LegalDiffLine[]; ozet: string };
}

const sayi = (n: number) => n.toLocaleString('tr-TR');

/** Satırın notu ve durumu (YonetimIcerik.dc.html › yasal) */
function durumOf(s: Satir) {
  const not = [
    s.yayinda
      ? `s.${s.yayinda.version} yayında · ${s.yayinda.tarih ?? ''} · ${sayi(s.yayinda.onaylayan)} kullanıcı onayladı`
      : 'Henüz yayınlanmadı',
    s.taslak
      ? `s.${s.taslak.version} taslak ${s.taslak.onayda ? 'sahip onayında' : 'hazır'}${
          !s.yayinda && s.taslak.onaylayan ? ` · yayın öncesi ${sayi(s.taslak.onaylayan)} onay` : ''
        }`
      : null,
    s.kullanim,
  ]
    .filter(Boolean)
    .join(' · ');
  const durum = s.taslak?.onayda
    ? { ad: 'Onayda', bg: '#EEF3FF', fg: '#2450C8' }
    : s.taslak
      ? { ad: 'Taslak var', bg: '#FFF6DF', fg: '#7A5300' }
      : { ad: 'Yayında', bg: '#E7FAF0', fg: '#11683F' };
  return { not, durum };
}

/**
 * Yasal metinler (Karar 46, 59): sürümlü; yayın sahip onayıyla. Kullanıcıların onayladığı metin değişmez, düzenleme yeni
 * sürüm açar. Esaslı değişiklik yayınlanınca kullanıcılara bildirim gider ve bir sonraki girişte yeni sürüm onaylatılır.
 */
export function YasalMetinler({ yazabilir }: { yazabilir: boolean }) {
  const [liste, setListe] = useState<Satir[] | null>(null);
  const [acik, setAcik] = useState<{ key: LegalKey; mod: 'fark' | 'duzenle' } | null>(null);
  const [d, setD] = useState<Detay | null>(null);
  const [form, setForm] = useState<{ title: string; body: string; material: boolean; not: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const yukle = useCallback(() => {
    yonetim<Satir[]>('legal')
      .then(setListe)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(yukle, [yukle]);

  const ac = useCallback(async (key: LegalKey, mod: 'fark' | 'duzenle', karsilastir?: number) => {
    setHata(null);
    const x = await yonetim<Detay>(`legal/${key}${karsilastir ? `?karsilastir=${karsilastir}` : ''}`);
    setD(x);
    setAcik({ key, mod });
    const kaynak = x.taslak ?? x.yayinda;
    setForm(
      mod === 'duzenle' && kaynak
        ? {
            title: kaynak.title,
            body: kaynak.body,
            material: x.taslak?.material ?? false,
            not: x.taslak?.not ?? '',
          }
        : null,
    );
  }, []);

  async function islem(fn: () => Promise<string>) {
    setBusy(true);
    setHata(null);
    setBilgi(null);
    try {
      setBilgi(await fn());
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="k-panel" style={{ overflow: 'hidden' }} aria-labelledby="yasal">
      <h2
        id="yasal"
        style={{
          margin: 0,
          padding: '16px 18px',
          fontSize: 17,
          fontWeight: 800,
          borderBottom: '1px solid #EEF0F5',
        }}
      >
        Yasal metinler
      </h2>
      {hata ? (
        <p className="k-error" role="alert" style={{ margin: '10px 18px' }}>
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p className="k-ok" role="status" style={{ margin: '10px 18px' }}>
          {bilgi}
        </p>
      ) : null}
      {liste === null ? <div className="k-empty">Yükleniyor…</div> : null}
      {liste?.map((s) => {
        const { not, durum } = durumOf(s);
        // Karşılaştırılacak sürüm: yayındaki; yayın öncesi dönemde önceki taslak
        const karsi = s.taslak
          ? (s.yayinda?.version ?? (s.taslak.version > 1 ? s.taslak.version - 1 : null))
          : null;
        return (
          <div key={s.key} style={{ borderBottom: '1px solid #EEF0F5' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px 16px',
                padding: '12px 18px',
              }}
            >
              <span style={{ flex: '999 1 260px', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{s.ad}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                  {not}
                </span>
              </span>
              <span
                style={{
                  flex: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: durum.bg,
                  color: durum.fg,
                }}
              >
                {durum.ad}
              </span>
              {karsi ? (
                <button
                  type="button"
                  className="k-btn-line"
                  style={{ fontSize: 13, padding: '7px 12px' }}
                  aria-expanded={acik?.key === s.key && acik.mod === 'fark'}
                  onClick={() =>
                    acik?.key === s.key && acik.mod === 'fark' ? setAcik(null) : void ac(s.key, 'fark', karsi)
                  }
                >
                  s.{karsi} ile karşılaştır
                </button>
              ) : null}
              {yazabilir ? (
                <button
                  type="button"
                  className="k-btn-line"
                  style={{ fontSize: 13, padding: '7px 12px' }}
                  aria-expanded={acik?.key === s.key && acik.mod === 'duzenle'}
                  onClick={() =>
                    acik?.key === s.key && acik.mod === 'duzenle' ? setAcik(null) : void ac(s.key, 'duzenle')
                  }
                >
                  {s.taslak ? 'Taslağı düzenle' : 'Yeni sürüm'}
                </button>
              ) : null}
            </div>
            {acik?.key === s.key && d ? (
              acik.mod === 'fark' ? (
                <Fark d={d} />
              ) : form ? (
                <div style={{ padding: '14px 18px', background: '#F6F8FD' }}>
                  {d.taslak?.kilitli ? (
                    <p className="k-note" style={{ marginTop: 0 }}>
                      Kullanıcılar s.{d.taslak.version} taslağını onayladı; kaydedince yeni sürüm (s.
                      {d.taslak.version + 1}) açılır, onaylanan metin değişmez.
                    </p>
                  ) : null}
                  {d.taslak?.onayda ? (
                    <p className="k-note" style={{ marginTop: 0 }}>
                      Bu taslak sahip onayında. Kaydedersen yeni sürüm açılır ve yeniden onaya gönderilmesi
                      gerekir.
                    </p>
                  ) : null}
                  <label className="k-field" style={{ display: 'block' }}>
                    Başlık
                    <input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      maxLength={160}
                    />
                  </label>
                  <label className="k-field" style={{ display: 'block', marginTop: 10 }}>
                    Metin (Markdown: ## başlık, boş satırla paragraf)
                    <textarea
                      value={form.body}
                      onChange={(e) => setForm({ ...form, body: e.target.value })}
                      rows={16}
                      style={{
                        display: 'block',
                        width: '100%',
                        marginTop: 5,
                        border: '1px solid #D5DAE5',
                        borderRadius: 10,
                        padding: 11,
                        font: 'inherit',
                        fontSize: 13.5,
                        fontWeight: 400,
                        lineHeight: 1.5,
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>
                  <label className="k-field" style={{ display: 'block', marginTop: 10 }}>
                    Değişiklik notu (onay isteğinde görünür)
                    <input
                      value={form.not}
                      onChange={(e) => setForm({ ...form, not: e.target.value })}
                      maxLength={500}
                      placeholder="Ör. madde 7.2 iade koşulu avukat önerisiyle güncellendi"
                    />
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      marginTop: 10,
                      fontSize: 13.5,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.material}
                      onChange={(e) => setForm({ ...form, material: e.target.checked })}
                      style={{ width: 18, height: 18, margin: '1px 0 0' }}
                    />
                    <span>
                      <strong>Esaslı değişiklik</strong>: yayınlanınca kullanıcılara bildirim gider ve bir
                      sonraki girişte yeni sürüm onaylatılır.
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button
                      type="button"
                      className="k-btn-line"
                      disabled={busy}
                      onClick={() =>
                        islem(async () => {
                          const r = await yonetim<{ version: number }>(`legal/${s.key}/draft`, {
                            method: 'PUT',
                            body: {
                              title: form.title,
                              body: form.body,
                              material: form.material,
                              ...(form.not.trim() ? { not: form.not.trim() } : {}),
                            },
                          });
                          await ac(s.key, 'duzenle');
                          return `${s.ad} s.${r.version} taslağı kaydedildi.`;
                        })
                      }
                    >
                      Taslağı kaydet
                    </button>
                    <button
                      type="button"
                      className="k-btn-ok"
                      disabled={busy || !d.taslak || d.taslak.onayda}
                      onClick={() =>
                        islem(async () => {
                          const r = await yonetim<{ version: number }>(`legal/${s.key}/submit`, {
                            method: 'POST',
                            body: {},
                          });
                          setAcik(null);
                          return `${s.ad} s.${r.version} sahip onayına gönderildi. Onaylanınca yayına girer${
                            d.taslak?.material
                              ? '; kullanıcılara bildirim gider ve girişte yeniden onaylatılır'
                              : ''
                          }.`;
                        })
                      }
                    >
                      Onaya gönder
                    </button>
                    <button type="button" className="k-btn-line" onClick={() => setAcik(null)}>
                      Kapat
                    </button>
                  </div>
                  {d.fark.satirlar.length ? (
                    <div style={{ marginTop: 14 }}>
                      <Fark d={d} />
                    </div>
                  ) : null}
                </div>
              ) : null
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

/** Sürüm farkı: silinen ve eklenen paragraflar bölüm başlığıyla (tasarımdaki − ve + satırları) */
function Fark({ d }: { d: Detay }) {
  // Ardışık aynı bölümdeki satırlar tek başlık altında; anahtarlar farkın sırasından (metin tekrarlanabilir)
  const gruplar: { id: string; bolum: string | null; satirlar: (LegalDiffLine & { id: string })[] }[] = [];
  d.fark.satirlar.forEach((s, n) => {
    const son = gruplar.at(-1);
    const satir = { ...s, id: `s${n}` };
    if (son && son.bolum === s.bolum) son.satirlar.push(satir);
    else gruplar.push({ id: `g${n}`, bolum: s.bolum, satirlar: [satir] });
  });
  const taslak = d.taslak && d.fark.yeni === d.taslak.version;
  return (
    <div style={{ padding: '14px 18px', background: '#F6F8FD', fontSize: 13, lineHeight: 1.6 }}>
      {gruplar.length === 0 ? (
        <div>
          s.{d.fark.eski} ile s.{d.fark.yeni} arasında metin farkı yok.
        </div>
      ) : (
        gruplar.map((g) => (
          <div key={g.id} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              {d.ad} · s.{d.fark.eski} → s.{d.fark.yeni}
              {taslak ? ' taslak' : ''}
              {g.bolum ? ` · ${g.bolum}` : ''}
            </div>
            {g.satirlar.map((s) => (
              <div
                key={s.id}
                style={
                  s.tip === 'sil'
                    ? {
                        background: '#FDECEC',
                        borderLeft: '3px solid #E5484D',
                        padding: '6px 10px',
                        borderRadius: '0 8px 8px 0',
                        color: '#5C1A15',
                        marginTop: 4,
                        whiteSpace: 'pre-wrap',
                      }
                    : {
                        background: '#E7FAF0',
                        borderLeft: '3px solid #3DD68C',
                        padding: '6px 10px',
                        borderRadius: '0 8px 8px 0',
                        marginTop: 4,
                        color: '#0B4A2C',
                        whiteSpace: 'pre-wrap',
                      }
                }
              >
                {s.tip === 'sil' ? '− ' : '+ '}
                {s.metin}
              </div>
            ))}
          </div>
        ))
      )}
      {d.taslak ? (
        <div style={{ marginTop: 8, fontSize: 12.5, color: '#3A4052' }}>
          {d.taslak.material
            ? 'Esaslı değişiklik: yayınlanınca kullanıcılara bildirim gider ve bir sonraki girişte yeni sürüm onaylatılır. '
            : 'Esaslı değişiklik değil: yayınlanınca kullanıcılardan yeniden onay istenmez. '}
          Yayın sahip onayı ister.
        </div>
      ) : null}
    </div>
  );
}
