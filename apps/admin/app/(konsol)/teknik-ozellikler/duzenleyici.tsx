'use client';

import {
  aralikMetni,
  aralikOku,
  type DonanimGrubu,
  donanimOku,
  donanimYaz,
  type EkSatir,
  TEKNIK_ALANLARI,
  TEKNIK_BOLUMLER,
  TEKNIK_SATIR_ANAHTARLARI,
  TEKNIK_SATIRLAR,
  type TeknikAlan,
  type TeknikDuzeltme,
  type TeknikOzet,
  teknikMetniOku,
} from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { tarih, yonetim } from '../../../lib/istemci';
import stil from './duzenleyici.module.css';

interface ModelVerisi {
  id: string;
  ad: string;
  arac: string | null;
  paketler: { id: string; ad: string; yillar: [number, number] | null }[];
  vitesler: string[];
  tipler: { ad: string; paket: string | null; vites: string | null; yillar: [number, number] | null }[];
  kaynak: TeknikOzet | null;
  sonuc: TeknikOzet | null;
  donanim: DonanimGrubu[] | null;
  duzeltmeler: {
    id: string;
    yillar: [number | null, number | null];
    paket: string | null;
    paketId: string | null;
    vites: string | null;
    degerler: TeknikDuzeltme;
    donanim: DonanimGrubu[] | null;
    gizli: string[];
    ekSatirlar: EkSatir[];
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

const VITES_AD: Record<string, string> = {
  manuel: 'Manuel',
  otomatik: 'Otomatik',
  yari_otomatik: 'Yarı otomatik',
};

/** Satır anahtarı → talep sayfasındaki etiketi */
const satirAdi = (k: string) => TEKNIK_SATIRLAR.find((t) => t.key === k)?.etiket ?? k;
/** Satırı olmayan alanlar hangi satırda gösterilir */
const SATIR_ICINDE: Record<string, string> = {
  kw: 'Güç satırında',
  gucDevir: 'Güç satırında',
  torkDevir: 'Tork satırında',
};

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
  const [vites, setVites] = useState('');
  /** Düzenlenen kayıt: kaydedince yenisi onun yerine geçer */
  const [yerine, setYerine] = useState<string | null>(null);
  const [tumTipler, setTumTipler] = useState(false);
  const [veri, setVeri] = useState<ModelVerisi | null>(null);
  const [form, setForm] = useState<Record<string, string | string[]>>({});
  const [metin, setMetin] = useState('');
  const [okunamayan, setOkunamayan] = useState<string[]>([]);
  const [adaylar, setAdaylar] = useState<EkSatir[]>([]);
  /** Bu kayıtla gizlenecek satırlar */
  const [gizli, setGizli] = useState<string[]>([]);
  /** Bu kayıtla eklenecek serbest satırlar */
  const [ekSatirlar, setEkSatirlar] = useState<EkSatir[]>([]);
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
    if (vites) q.set('vites', vites);
    yonetim<ModelVerisi>(`catalog/teknik/model/${modelId}?${q}`)
      .then(setVeri)
      .catch((e: Error) => setHata(e.message));
  }, [modelId, yilBas, yilSon, paket, vites]);
  useEffect(yukle, [yukle]);

  function metniOku() {
    setHata(null);
    setMesaj(null);
    const r = teknikMetniOku(metin);
    const alan = Object.keys(r.degerler).length;
    const oge = ogeSayisi(r.donanim);
    if (!alan && !oge && !r.yillar) {
      setOkunamayan(r.okunamayan);
      setAdaylar(r.ekAdaylari);
      if (r.ekAdaylari.length)
        return setMesaj(
          `Tanınan alan yok; ${r.ekAdaylari.length} satırı aşağıdan teknik tabloya ek satır olarak ekleyebilirsin.`,
        );
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
    // Metindeki vites türü bu sürümde satılıyorsa kayıt o vitese bağlanır (değiştirilebilir)
    const tur = r.degerler.vitesler?.length === 1 ? (r.degerler.vitesler[0] as string).split(':')[0] : null;
    const vitesSecildi = !vites && tur && veri?.vitesler.includes(tur) && (veri?.vitesler.length ?? 0) > 1;
    if (vitesSecildi) setVites(tur);
    setOkunamayan(r.okunamayan);
    setAdaylar(r.ekAdaylari);
    setMesaj(
      `${alan} alan${r.yillar ? ', yıl aralığı' : ''} ve ${oge} donanım öğesi dolduruldu${vitesSecildi ? `; vites "${VITES_AD[tur] ?? tur}" seçildi` : ''}. Kaydetmeden önce hangi araçlara uygulanacağını ve değerleri kontrol et.`,
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
    const ekler = ekSatirlar
      .map((e) => ({ bolum: e.bolum.trim(), etiket: e.etiket.trim(), deger: e.deger.trim() }))
      .filter((e) => e.etiket || e.deger);
    const yarim = ekler.find((e) => !e.bolum || !e.etiket || !e.deger);
    if (yarim)
      return setHata(`Ek satır "${yarim.etiket || yarim.deger}": bölüm, etiket ve değer dolu olmalı`);
    if (!Object.keys(degerler).length && !donanim.length && !gizli.length && !ekler.length)
      return setHata('En az bir değer, donanım, gizlenen ya da eklenen satır yaz');
    setMesgul(true);
    try {
      await yonetim(`catalog/teknik/model/${modelId}`, {
        method: 'POST',
        body: {
          yilBas: /^\d{4}$/.test(yilBas) ? Number(yilBas) : null,
          yilSon: /^\d{4}$/.test(yilSon) ? Number(yilSon) : null,
          paket: paket || null,
          vites: vites || null,
          yerine,
          degerler,
          donanim: donanim.length ? donanim : null,
          gizli,
          ekSatirlar: ekler,
          not: not.trim() || null,
          bildirim: bildirim ?? null,
        },
      });
      setForm({});
      setNot('');
      setMetin('');
      setDonanimMetni('');
      setOkunamayan([]);
      setAdaylar([]);
      setGizli([]);
      setEkSatirlar([]);
      const m = yerine
        ? 'Kayıt güncellendi (eskisi kaldırıldı); talep sayfasında hemen görünür.'
        : 'Kaydedildi; talep sayfasında ve sihirbazda hemen görünür.';
      setYerine(null);
      setMesaj(m);
      yukle();
      bitti?.(m);
    } catch (err) {
      setHata((err as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  /** Kaydı forma yükler; kaydedince yenisi onun yerine geçer */
  function duzenle(d: ModelVerisi['duzeltmeler'][number]) {
    setYerine(d.id);
    setYilBas(d.yillar[0] ? String(d.yillar[0]) : '');
    setYilSon(d.yillar[1] ? String(d.yillar[1]) : '');
    setPaket(d.paketId ?? '');
    setVites(d.vites ?? '');
    setForm(formaYaz(d.degerler));
    setDonanimMetni(d.donanim?.length ? donanimYaz(d.donanim) : '');
    setGizli(d.gizli);
    setEkSatirlar(d.ekSatirlar);
    setNot(d.not ?? '');
    setOkunamayan([]);
    setAdaylar([]);
    setHata(null);
    setMesaj(null);
    document.getElementById(`hedef-${modelId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function vazgec() {
    setYerine(null);
    setForm({});
    setDonanimMetni('');
    setGizli([]);
    setEkSatirlar([]);
    setNot('');
  }

  const gizleDegistir = (k: string) =>
    setGizli((g) => (g.includes(k) ? g.filter((x) => x !== k) : [...g, k]));
  const ekGuncelle = (i: number, alan: keyof EkSatir, v: string) =>
    setEkSatirlar((l) => l.map((e, j) => (j === i ? { ...e, [alan]: v } : e)));
  const adayEkle = (a: EkSatir[]) => {
    setEkSatirlar((l) => [
      ...l,
      ...a.filter((x) => !l.some((e) => e.etiket === x.etiket && e.bolum === x.bolum)),
    ]);
    setAdaylar((l) => l.filter((x) => !a.includes(x)));
  };

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
    <section className={`k-panel ${stil.kutu1}`} aria-label={`${veri.ad} teknik değerleri ve donanımı`}>
      <strong className={stil.metin1}>
        {veri.arac} {veri.ad}
      </strong>
      <p className={stil.metin2}>
        Yalnızca değiştirmek ya da eklemek istediğin alanı doldur; boş alan kaynaklardan (ADEME,
        vehicle-makes-models, TSB) gelmeye devam eder. Aralık için "150–170", liste için virgül kullan.
      </p>

      <div id={`hedef-${modelId}`} className={cx(stil.kutu2, yerine ? stil.kutu3 : stil.kutu4)}>
        <p className={stil.metin3}>
          {yerine ? 'Kaydı düzenliyorsun: hangi araçlara uygulanacak?' : '1. Hangi araçlara uygulanacak?'}
        </p>
        {yerine ? (
          <p className={stil.metin4}>
            Değerler ve donanım aşağıya yüklendi. Kaydedince bu kayıt eskisinin yerine geçer (eskisi silinmez,
            kaldırılır).{' '}
            <button type="button" className={`k-btn-line ${stil.dugme1}`} onClick={vazgec}>
              Düzenlemeyi bırak
            </button>
          </p>
        ) : null}
        <div className={stil.kutu5}>
          <label className={`k-field ${stil.etiket1}`}>
            İlk yıl
            <input
              inputMode="numeric"
              value={yilBas}
              placeholder="hepsi"
              onChange={(e) => setYilBas(e.target.value)}
            />
          </label>
          <label className={`k-field ${stil.etiket1}`}>
            Son yıl
            <input
              inputMode="numeric"
              value={yilSon}
              placeholder="devam"
              onChange={(e) => setYilSon(e.target.value)}
            />
          </label>
          <label className={`k-field ${stil.etiket2}`}>
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
          </label>
          <label className={`k-field ${stil.etiket3}`}>
            Vites
            <select value={vites} onChange={(e) => setVites(e.target.value)}>
              <option value="">Bütün vitesler</option>
              {[...new Set([...veri.vitesler, ...(vites ? [vites] : [])])].map((v) => (
                <option key={v} value={v}>
                  {VITES_AD[v] ?? v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={stil.metin5}>
          {veri.tipler.length
            ? `Bu kayıt Türkiye'de satılan şu ${veri.tipler.length} tipe uygulanır:`
            : 'Bu yıl, paket ve vitesle satılan tip yok; seçimi değiştir.'}
        </p>
        {veri.tipler.length ? (
          <ul className={stil.liste1}>
            {(tumTipler ? veri.tipler : veri.tipler.slice(0, 10)).map((t) => (
              <li key={`${t.ad}-${t.paket}-${t.vites}`}>
                {t.ad}
                <span className={stil.metin6}>
                  {' '}
                  · {t.vites ? (VITES_AD[t.vites] ?? t.vites) : 'vites belirtilmemiş'}
                  {t.yillar ? ` · ${t.yillar[0]}–${t.yillar[1]}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {veri.tipler.length > 10 ? (
          <button
            type="button"
            className={`k-btn-line ${stil.dugme2}`}
            onClick={() => setTumTipler((v) => !v)}
          >
            {tumTipler ? 'Daha az göster' : `Hepsini göster (${veri.tipler.length})`}
          </button>
        ) : null}
        <p className={stil.metin7}>
          Talep açan kişi bu yılları, paketi ve vitesi seçtiğinde teknik sekmesinde bu kaydı görür; başka
          paket ya da vites seçene başka kayıt girebilirsin. Vitesi TSB adında yazmayan tipler yalnızca "Bütün
          vitesler" kaydını alır.
        </p>
      </div>

      <div className={stil.kutu6}>
        <label className={`k-field ${stil.etiket4}`}>
          2. Metinden doldur (isteğe bağlı)
          <textarea
            value={metin}
            rows={7}
            placeholder={
              '--Genel Bakış--\nMotor Gücü\t90 hp\nŞanzıman / Çekiş\tX-Tronic / Önden Çekiş\n…\n--Donanım--\n-Güvenlik-\nABS'
            }
            onChange={(e) => setMetin(e.target.value)}
            className={stil.girdi1}
          />
        </label>
        <p className={stil.metin8}>
          Teknik özellik ve donanım metnini olduğu gibi yapıştır. Tanınan satırlar aşağıdaki alanlara, üretim
          yılı yıl aralığına, "--Donanım--" bölümü donanım kutusuna yazılır. Hiçbir şey kaydedilmez; kontrol
          edip kaydet.
        </p>
        <button type="button" className="k-btn-ok" disabled={!metin.trim()} onClick={metniOku}>
          Metni oku ve doldur
        </button>
        {okunamayan.length ? (
          <div className={stil.kutu7}>
            <p className={stil.metin9}>Okunamayan satırlar ({okunamayan.length}): gerekirse elle gir</p>
            <ul className={stil.liste2}>
              {okunamayan.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {adaylar.length ? (
          <div className={stil.kutu7}>
            <p className={stil.metin10}>
              Bunları teknik tabloya ek satır olarak ekleyebilirsin:{' '}
              <button type="button" className={`k-btn-line ${stil.dugme1}`} onClick={() => adayEkle(adaylar)}>
                Hepsini ekle ({adaylar.length})
              </button>
            </p>
            <div className={stil.kutu8}>
              {adaylar.map((a) => (
                <button
                  key={`${a.bolum}|${a.etiket}`}
                  type="button"
                  className={`k-btn-line ${stil.dugme3}`}
                  title={`${a.bolum} bölümüne eklenir`}
                  onClick={() => adayEkle([a])}
                >
                  + {a.etiket}: {a.deger}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <form onSubmit={kaydet}>
        <div className={stil.kutu9}>
          <label className={`k-field ${stil.etiket5}`}>
            Not (isteğe bağlı, kaynak ya da gerekçe)
            <input value={not} maxLength={500} onChange={(e) => setNot(e.target.value)} />
          </label>
        </div>
        <div className={stil.kutu10}>
          <table className={stil.tablo1}>
            <thead>
              <tr className={stil.tablo2}>
                <th className={stil.tablo3}>Alan</th>
                <th className={stil.tablo3}>Şu an gösterilen</th>
                <th className={stil.tablo3}>Kaynaktaki</th>
                <th className={stil.tablo4}>Yeni değer</th>
                <th className={stil.tablo5}>Talep sayfasında</th>
              </tr>
            </thead>
            <tbody>
              {TEKNIK_ALANLARI.map((a) => {
                const simdi = oku(veri.sonuc, a);
                const kaynak = oku(veri.kaynak, a);
                const yeni = form[a.key];
                const dolu = Array.isArray(yeni) ? yeni.length > 0 : !!yeni?.trim();
                const satirVar = TEKNIK_SATIR_ANAHTARLARI.has(a.key);
                const buKayit = gizli.includes(a.key);
                // Düzenlenen kayıt dışındaki, bu seçime uyan bir kayıt gizliyorsa
                const baskaKayit =
                  !buKayit &&
                  !!veri.sonuc?.gizli?.includes(a.key) &&
                  veri.duzeltmeler.some((d) => d.id !== yerine && d.gizli.includes(a.key));
                return (
                  <tr
                    key={a.key}
                    className={stil.tablo6}
                    style={{ background: buKayit ? '#FFF4F4' : dolu ? '#F2FBF6' : undefined }}
                  >
                    <td className={stil.tablo7}>
                      {a.ad}
                      {a.birim ? <span className={stil.metin11}> ({a.birim})</span> : null}
                    </td>
                    <td className={cx(stil.tablo3, simdi !== kaynak ? stil.tablo8 : undefined)}>
                      {simdi || '—'}
                    </td>
                    <td className={stil.tablo9}>{kaynak || '—'}</td>
                    <td className={stil.tablo3}>
                      {a.tur === 'secim' ? (
                        <span className={stil.metin12}>
                          {a.secenekler?.map(([v, ad]) => {
                            const secili = ((form[a.key] as string[] | undefined) ?? []).includes(v);
                            return (
                              <label key={v} className={stil.etiket6}>
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
                          className={stil.girdi2}
                        />
                      )}
                    </td>
                    <td className={stil.tablo10}>
                      {satirVar ? (
                        <label
                          className={stil.etiket7}
                          title="İşareti kaldırırsan bu satır bu araçta gösterilmez"
                        >
                          <input
                            type="checkbox"
                            aria-label={`${a.ad} satırını göster`}
                            checked={!buKayit && !baskaKayit}
                            disabled={baskaKayit}
                            onChange={() => gizleDegistir(a.key)}
                          />
                          {buKayit ? (
                            <span className={stil.metin13}>Gizlenecek</span>
                          ) : baskaKayit ? (
                            <span className={stil.metin14}>Başka kayıtta gizli</span>
                          ) : (
                            'Göster'
                          )}
                        </label>
                      ) : (
                        <span className={stil.metin6}>{SATIR_ICINDE[a.key] ?? '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={stil.kutu11}>
          <p className={stil.metin15}>Ek satırlar</p>
          <p className={stil.metin16}>
            Tabloda olmayan bir bilgiyi ekle (ör. Genel › Garanti: 5 yıl). Var olan bir bölümü seçebilir ya da
            yeni bölüm adı yazabilirsin; aynı bölümde aynı adlı satır varsa onun yerine geçer.
          </p>
          <datalist id={`bolumler-${modelId}`}>
            {TEKNIK_BOLUMLER.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          {ekSatirlar.map((e, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: satırlar yalnızca sırayla düzenlenir
              key={i}
              className={stil.kutu12}
            >
              <input
                aria-label="Bölüm"
                list={`bolumler-${modelId}`}
                value={e.bolum}
                placeholder="Bölüm"
                maxLength={60}
                onChange={(x) => ekGuncelle(i, 'bolum', x.target.value)}
                className={stil.girdi3}
              />
              <input
                aria-label="Etiket"
                value={e.etiket}
                placeholder="Etiket (ör. Garanti)"
                maxLength={80}
                onChange={(x) => ekGuncelle(i, 'etiket', x.target.value)}
                className={stil.girdi3}
              />
              <input
                aria-label="Değer"
                value={e.deger}
                placeholder="Değer (ör. 5 yıl)"
                maxLength={200}
                onChange={(x) => ekGuncelle(i, 'deger', x.target.value)}
                className={stil.girdi4}
              />
              <button
                type="button"
                className={`k-btn-line ${stil.dugme4}`}
                onClick={() => setEkSatirlar((l) => l.filter((_, j) => j !== i))}
              >
                Sil
              </button>
            </div>
          ))}
          <button
            type="button"
            className={`k-btn-line ${stil.dugme5}`}
            onClick={() => setEkSatirlar((l) => [...l, { bolum: 'Genel', etiket: '', deger: '' }])}
          >
            + Satır ekle
          </button>
          {veri.sonuc?.ekSatirlar?.length && !yerine ? (
            <p className={stil.metin17}>
              Şu an eklenmiş:{' '}
              {veri.sonuc.ekSatirlar.map((e) => `${e.bolum} › ${e.etiket}: ${e.deger}`).join(' · ')}
            </p>
          ) : null}
        </div>

        <div className={stil.kutu13}>
          <label className={`k-field ${stil.etiket8}`}>
            Donanım
            {paket ? ` (${veri.paketler.find((p) => p.id === paket)?.ad} paketi)` : ' (bütün paketler)'}
            <textarea
              value={donanimMetni}
              rows={10}
              placeholder={'-Güvenlik-\nABS\nIsofix\n-Konfor-\nHız Sabitleme Sistemi'}
              onChange={(e) => setDonanimMetni(e.target.value)}
              className={stil.girdi5}
            />
            <span className={stil.metin18}>
              Her grup "-Grup adı-" satırıyla başlar, altında her satır bir öğe. Kaydedilen liste bu paketin
              önceki listesinin yerine geçer.
            </span>
          </label>
          <div className={stil.kutu14}>
            <p className={stil.metin19}>
              {donanimOnizleme.length
                ? `Kaydedilecek: ${ogeSayisi(donanimOnizleme)} öğe, ${donanimOnizleme.length} grup`
                : `Şu an gösterilen: ${veri.donanim ? `${ogeSayisi(veri.donanim)} öğe` : 'donanım yok'}`}
            </p>
            {(donanimOnizleme.length ? donanimOnizleme : (veri.donanim ?? [])).map((g) => (
              <p key={g.ad} className={stil.metin20}>
                <strong className={stil.metin21}>{g.ad}:</strong> {g.ogeler.join(', ')}
              </p>
            ))}
          </div>
        </div>

        {hata ? (
          <p className={`k-error ${stil.metin22}`} role="alert">
            {hata}
          </p>
        ) : null}
        {mesaj ? (
          <p className={`k-ok ${stil.metin22}`} role="status">
            {mesaj}
          </p>
        ) : null}
        <button type="submit" className={`k-btn-ok ${stil.metin22}`} disabled={mesgul}>
          {mesgul
            ? 'Kaydediliyor…'
            : yerine
              ? 'Değişikliği kaydet'
              : bildirim
                ? 'Kaydet ve bildirimi kapat'
                : 'Kaydet'}
        </button>
      </form>

      <h3 className={stil.baslik1}>Etkin kayıtlar</h3>
      {veri.duzeltmeler.length === 0 ? (
        <p className={stil.metin23}>Bu sürümde elle girilmiş kayıt yok.</p>
      ) : (
        veri.duzeltmeler.map((d) => (
          <div key={d.id} className={stil.kutu15}>
            <span className={stil.metin24}>
              <strong>
                {d.yillar[0] || d.yillar[1] ? `${d.yillar[0] ?? '…'}–${d.yillar[1] ?? '…'}` : 'Bütün yıllar'}
                {d.paket ? ` · ${d.paket} paketi` : ' · bütün paketler'}
                {d.vites ? ` · ${VITES_AD[d.vites] ?? d.vites}` : ' · bütün vitesler'}
              </strong>
              {Object.keys(d.degerler).length ? ` · ${yaz(d.degerler)}` : ''}
              {d.donanim?.length ? ` · Donanım: ${ogeSayisi(d.donanim)} öğe` : ''}
              {d.gizli.length ? ` · Gizli: ${d.gizli.map(satirAdi).join(', ')}` : ''}
              {d.ekSatirlar.length
                ? ` · Ek: ${d.ekSatirlar.map((e) => `${e.etiket}: ${e.deger}`).join(', ')}`
                : ''}
              {d.not ? <span className={stil.metin6}> · {d.not}</span> : null}
              <span className={stil.metin6}> · {tarih(d.zaman)}</span>
            </span>
            <span className={stil.metin25}>
              <button
                type="button"
                className={`k-btn-line ${stil.dugme5}`}
                disabled={yerine === d.id}
                onClick={() => duzenle(d)}
              >
                {yerine === d.id ? 'Düzenleniyor' : 'Düzenle'}
              </button>
              <button type="button" className={`k-btn-line ${stil.dugme6}`} onClick={() => kaldir(d.id)}>
                Kaldır
              </button>
            </span>
          </div>
        ))
      )}
    </section>
  );
}
