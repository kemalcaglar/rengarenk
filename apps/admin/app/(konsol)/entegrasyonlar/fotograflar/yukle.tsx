'use client';

import { GORSEL_EN_AZ_GENISLIK, GORSEL_LISANSLARI } from '@rengarenk/shared';
import { useState } from 'react';
import stil from './yukle.module.css';

export interface Hedef {
  tur: 'nesil' | 'kusak' | 'seri';
  id: string;
  makyaj: number | null;
}

const MAKYAJLAR: [string, string][] = [
  ['', 'Nesil geneli'],
  ['0', 'Makyaj öncesi'],
  ['1', '1. makyaj'],
  ['2', '2. makyaj'],
];

/**
 * Elle fotoğraf yükleme (sahip isteği, 17 Kasım 2026): bulunan fotoğraf nesle, kasaya ya da modele eklenir. Karar 34
 * gereği kaynak sayfası, yazar ve ticari kullanıma izin veren lisans zorunludur; başka sitelerdeki ilan fotoğrafları ve
 * lisanssız üretici görselleri yüklenmez. Fotoğraf hemen yayına girer, aynı yerdeki eski fotoğraf kaldırılır.
 */
export function YuklemeFormu({
  hedef,
  bitti,
  iptal,
}: {
  hedef: Hedef;
  bitti: (mesaj: string) => void;
  iptal: () => void;
}) {
  const [dosya, setDosya] = useState<File | null>(null);
  const [kaynak, setKaynak] = useState('');
  const [yazar, setYazar] = useState('');
  const [lisans, setLisans] = useState<string>('');
  const [makyaj, setMakyaj] = useState(hedef.makyaj === null ? '' : String(hedef.makyaj));
  const [yilBas, setYilBas] = useState('');
  const [yilSon, setYilSon] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!dosya) return setHata('Fotoğraf seç');
    setHata(null);
    setMesgul(true);
    try {
      const q = new URLSearchParams({ tur: hedef.tur, id: hedef.id, kaynak, yazar, lisans });
      if (hedef.tur === 'nesil' && makyaj !== '') q.set('makyaj', makyaj);
      if (hedef.tur === 'seri' && yilBas) q.set('yilBas', yilBas);
      if (hedef.tur === 'seri' && yilSon) q.set('yilSon', yilSon);
      const res = await fetch(`/api/yonetim/catalog/images/yukle?${q}`, {
        method: 'POST',
        headers: { 'x-rr-istek': '1', 'content-type': dosya.type || 'image/jpeg' },
        body: dosya,
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string | string[];
        issues?: { message: string }[];
      } | null;
      if (!res.ok) {
        const m =
          data?.issues?.[0]?.message ?? (Array.isArray(data?.message) ? data?.message[0] : data?.message);
        throw new Error(m ?? 'Fotoğraf yüklenemedi');
      }
      bitti('Fotoğraf yüklendi ve yayına girdi; bu yerdeki talepler artık bu fotoğrafla görünüyor.');
    } catch (err) {
      setHata((err as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <form onSubmit={gonder} className={stil.kutu1}>
      <p className={stil.metin1}>
        Yalnızca kamu malı, CC0, CC BY, CC BY-SA lisanslı, kendi çektiğimiz ya da yazılı izinle kullandığımız
        fotoğraf (Karar 34). Başka sitelerdeki ilan fotoğrafları ve lisanssız üretici görselleri yüklenmez.
        JPEG, PNG ya da WEBP, en az {GORSEL_EN_AZ_GENISLIK} piksel genişlik; tercihen dış çekim, ön çapraz
        açı, araç tam kadrajda.
      </p>
      <label className="k-field">
        Fotoğraf
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className={stil.kutu2}>
        <label className={`k-field ${stil.etiket1}`}>
          Kaynak sayfası
          <input
            type="url"
            required
            placeholder="https://commons.wikimedia.org/wiki/File:…"
            value={kaynak}
            onChange={(e) => setKaynak(e.target.value)}
          />
        </label>
        <label className={`k-field ${stil.etiket2}`}>
          Yazar ya da hak sahibi
          <input required value={yazar} onChange={(e) => setYazar(e.target.value)} />
        </label>
        <label className={`k-field ${stil.etiket3}`}>
          Lisans
          <select required value={lisans} onChange={(e) => setLisans(e.target.value)}>
            <option value="" disabled>
              Seç
            </option>
            {GORSEL_LISANSLARI.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {hedef.tur === 'nesil' ? (
          <label className={`k-field ${stil.etiket4}`}>
            Makyaj
            <select value={makyaj} onChange={(e) => setMakyaj(e.target.value)}>
              {MAKYAJLAR.map(([v, ad]) => (
                <option key={v} value={v}>
                  {ad}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {hedef.tur === 'seri' ? (
          <>
            <label className={`k-field ${stil.etiket5}`}>
              İlk yıl (isteğe bağlı)
              <input
                inputMode="numeric"
                pattern="\d{4}"
                value={yilBas}
                onChange={(e) => setYilBas(e.target.value)}
              />
            </label>
            <label className={`k-field ${stil.etiket5}`}>
              Son yıl (isteğe bağlı)
              <input
                inputMode="numeric"
                pattern="\d{4}"
                value={yilSon}
                onChange={(e) => setYilSon(e.target.value)}
              />
            </label>
          </>
        ) : null}
      </div>
      {hata ? (
        <p className={`k-error ${stil.metin2}`} role="alert">
          {hata}
        </p>
      ) : null}
      <div className={stil.kutu3}>
        <button type="submit" className="k-btn-ok" disabled={mesgul}>
          {mesgul ? 'Yükleniyor…' : 'Yükle ve yayına al'}
        </button>
        <button type="button" className="k-btn-line" onClick={iptal} disabled={mesgul}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}
