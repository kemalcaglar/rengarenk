'use client';

import {
  type DonanimGrubu,
  TEKNIK_ALANLARI,
  TEKNIK_KAYNAK,
  type TeknikOzet,
  teknikBolumleri,
  teknikOneCikanlar,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useState } from 'react';
import { cx } from '../lib/cx';
import { istek, useGiris } from '../lib/istemci';
import { colors } from '../lib/renk';
import stil from './teknik-tablo.module.css';

/** Gökkuşağı açık zeminleri ve noktalar (tasarım: TINTS, DOTS; talep sayfasındaki "Aranan araç" kutularıyla aynı) */
const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0'];
const NOKTA = [colors.blue, colors.pink, colors.yellow, colors.green];

/**
 * Talep sayfasında aracın ayrıntılı teknik özellikleri (sahip isteği, 17 ve 18 Kasım 2026): motor sürümü başına öne
 * çıkan değerler (renkli kutular), bölüm kartları (genel, motor, performans, şanzıman ve çekiş, tüketim ve emisyon,
 * ölçüler ve ağırlık, lastik ve fren; konsolda gizlenen satırlar çıkar, eklenenler girer) ve paket donanımı. Değerler
 * Türkiye'de satılan sürümlerle eşleşen kayıtlardan; sürümler arasında farklıysa aralık.
 */
export function TeknikTablo({
  motorlar,
  not,
  talepNo,
}: {
  motorlar: {
    ad: string;
    model?: string;
    ozet: TeknikOzet;
    /** Konsoldan girilen donanım (sahip isteği, 18 Kasım 2026); pakete özelse paketin adıyla */
    donanim?: { paket: string | null; gruplar: DonanimGrubu[] }[];
  }[];
  /** Verilirse "Yanlış mı? Bildir" düğmesi görünür (sahip isteği, 17 Kasım 2026) */
  talepNo?: number;
  /** Başlık altı açıklama (ör. "G20 makyajsız kasa, 2019–2022") */
  not?: string | null;
}) {
  const [secili, setSecili] = useState(0);
  if (!motorlar.length) {
    return (
      <div className={stil.kutu1}>
        Bu araç için katalogda teknik bilgi bulunamadı. Motor ya da kasa seçilince ayrıntı genişler.
      </div>
    );
  }
  const m = motorlar[Math.min(secili, motorlar.length - 1)] as (typeof motorlar)[number];
  const bolumler = teknikBolumleri(m.ozet);
  const one = teknikOneCikanlar(m.ozet);
  return (
    <div>
      {motorlar.length > 1 ? (
        <div role="tablist" aria-label="Motor seçenekleri" className={`rr-yatay-kay ${stil.kutu2}`}>
          {motorlar.map((x, i) => (
            <button
              key={x.ad}
              type="button"
              role="tab"
              aria-selected={i === secili}
              onClick={() => setSecili(i)}
              className={cx(stil.dugme1, i === secili ? stil.dugme2 : stil.dugme3)}
            >
              {x.ad}
            </button>
          ))}
        </div>
      ) : (
        <p className={stil.metin1}>{m.ad}</p>
      )}
      {not ? <p className={stil.metin2}>{not}</p> : null}

      {one.length ? (
        <ul aria-label="Öne çıkan değerler" className={stil.liste1}>
          {one.map((x, i) => (
            <li key={x.etiket} className={stil.oge1} style={{ background: TINTS[i % TINTS.length] }}>
              <div className={stil.kutu3}>{x.etiket}</div>
              <div className={stil.kutu4}>
                <span className={stil.metin3}>{x.deger}</span>
                <span className={stil.metin4}>{x.birim}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Bölümler sütunlara akar (genişse iki sütun, kısa ve uzun bölümler boşluk bırakmadan) */}
      <div className={stil.kutu5}>
        {bolumler.map((b, i) => (
          <section key={b.baslik} aria-label={b.baslik} className={stil.kutu6}>
            <h3 className={stil.baslik1}>
              <span
                aria-hidden="true"
                className={stil.metin5}
                style={{ background: NOKTA[i % NOKTA.length] }}
              />
              {b.baslik}
            </h3>
            <dl className={stil.liste2}>
              {b.satirlar.map(([etiket, deger], j) => (
                <div key={etiket} className={cx(stil.kutu7, j ? stil.kutu8 : stil.kutu9)}>
                  <dt className={stil.metin6}>{etiket}</dt>
                  <dd className={stil.metin7}>{deger}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {m.donanim?.length ? <Donanim key={m.ad} liste={m.donanim} /> : null}

      <div className={stil.kutu10}>
        <p className={stil.metin8}>
          {TEKNIK_KAYNAK}.
          {m.ozet.kaynaklar?.includes('manuel') || m.donanim?.length
            ? ' Bazı değerler ve donanım ekibimizce girildi.'
            : ''}{' '}
          Değerler pakete ve model yılına göre değişebilir.
        </p>
        {talepNo && m.model ? (
          <YanlisBildir key={m.model} talepNo={talepNo} motor={m.model} ad={m.ad} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Teknik özellik "yanlış" bildirimi (sahip isteği, 17 Kasım 2026): küçük bir düğme; açılınca alan (isteğe bağlı) ve
 * kısa açıklama. Bildirim konsolda Katalog › Teknik özellikler kuyruğuna düşer. Giriş gerekir.
 */
function YanlisBildir({ talepNo, motor, ad }: { talepNo: number; motor: string; ad: string }) {
  const giris = useGiris();
  const [acik, setAcik] = useState(false);
  const [alan, setAlan] = useState('');
  const [not, setNot] = useState('');
  const [durum, setDurum] = useState<'bos' | 'gonderiliyor' | 'tamam'>('bos');
  const [hata, setHata] = useState<string | null>(null);

  if (durum === 'tamam')
    return (
      <p role="status" className={stil.metin9}>
        Teşekkürler, bildirimin ekibimize ulaştı.
      </p>
    );
  if (!acik)
    return (
      <button type="button" className={stil.dugme4} onClick={() => setAcik(true)}>
        Bir değer yanlış mı? Bildir
      </button>
    );
  if (giris === false)
    return (
      <p className={stil.metin10}>
        Bildirmek için{' '}
        <Link href={`/giris?sonra=/talep/${talepNo}`} className={stil.bag1}>
          giriş yap
        </Link>
        .
      </p>
    );

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setDurum('gonderiliyor');
    try {
      await istek('/demands/teknik-bildir', {
        method: 'POST',
        body: { no: talepNo, motor, alan: alan || null, not },
      });
      setDurum('tamam');
    } catch (err) {
      setHata((err as Error).message);
      setDurum('bos');
    }
  }

  return (
    <form onSubmit={gonder} aria-label={`${ad} teknik özellik bildirimi`} className={stil.kutu11}>
      <strong className={stil.metin11}>{ad}: hangi değer yanlış?</strong>
      <select
        aria-label="Yanlış olan değer"
        value={alan}
        onChange={(e) => setAlan(e.target.value)}
        className={stil.girdi1}
      >
        <option value="">Genel / birden çok değer</option>
        {TEKNIK_ALANLARI.map((a) => (
          <option key={a.key} value={a.key}>
            {a.ad}
          </option>
        ))}
      </select>
      <textarea
        aria-label="Açıklama"
        required
        minLength={5}
        maxLength={1000}
        rows={3}
        placeholder="Ör. Güç 184 hp olmalı, ruhsatta öyle yazıyor"
        value={not}
        onChange={(e) => setNot(e.target.value)}
        className={stil.girdi2}
      />
      {hata ? (
        <p role="alert" className={stil.metin12}>
          {hata}
        </p>
      ) : null}
      <div className={stil.kutu12}>
        <button type="submit" disabled={durum === 'gonderiliyor'} className={stil.dugme5}>
          {durum === 'gonderiliyor' ? 'Gönderiliyor…' : 'Gönder'}
        </button>
        <button type="button" className={stil.dugme4} onClick={() => setAcik(false)}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}

/** Bir grupta ilk bakışta gösterilen öğe sayısı (fazlası "+N daha" ile açılır) */
const GRUP_ILK = 8;

/**
 * Donanım (sahip isteği, 18 Kasım 2026): birden çok paket listesi varsa paket sekmeleri; gruplar renkli başlıklı
 * kartlarda, öğeler yeşil işaretle. Uzun gruplar kısaltılır.
 */
function Donanim({ liste }: { liste: { paket: string | null; gruplar: DonanimGrubu[] }[] }) {
  const [secili, setSecili] = useState(0);
  const [acik, setAcik] = useState<Record<string, boolean>>({});
  const d = liste[Math.min(secili, liste.length - 1)] as (typeof liste)[number];
  const toplam = d.gruplar.reduce((n, g) => n + g.ogeler.length, 0);
  return (
    <section aria-label="Donanım" className={stil.kutu13}>
      <div className={stil.kutu14}>
        <h3 className={stil.baslik2}>Donanım</h3>
        <span className={stil.metin13}>
          {d.paket ? `${d.paket} paketi · ` : ''}
          {toplam} özellik
        </span>
      </div>
      {liste.length > 1 ? (
        <div role="tablist" aria-label="Paketler" className={`rr-yatay-kay ${stil.kutu15}`}>
          {liste.map((x, i) => (
            <button
              key={x.paket ?? ''}
              type="button"
              role="tab"
              aria-selected={i === secili}
              onClick={() => setSecili(i)}
              className={cx(stil.dugme6, i === secili ? stil.dugme7 : stil.dugme8)}
            >
              {x.paket ?? 'Bütün paketler'}
            </button>
          ))}
        </div>
      ) : null}
      <div className={stil.kutu16}>
        {d.gruplar.map((g, i) => {
          const anahtar = `${d.paket ?? ''}|${g.ad}`;
          const hepsi = acik[anahtar] || g.ogeler.length <= GRUP_ILK + 1;
          const ogeler = hepsi ? g.ogeler : g.ogeler.slice(0, GRUP_ILK);
          return (
            <div key={g.ad} className={stil.kutu17}>
              <p className={stil.metin14} style={{ background: TINTS[i % TINTS.length] }}>
                {g.ad}
                <span className={stil.metin15}>{g.ogeler.length}</span>
              </p>
              <ul className={stil.liste3}>
                {ogeler.map((o) => (
                  <li key={o} className={stil.oge2}>
                    <span aria-hidden="true" className={stil.metin16}>
                      ✓
                    </span>
                    {o}
                  </li>
                ))}
              </ul>
              {g.ogeler.length > ogeler.length ? (
                <button
                  type="button"
                  onClick={() => setAcik((a) => ({ ...a, [anahtar]: true }))}
                  className={stil.dugme9}
                >
                  +{g.ogeler.length - ogeler.length} özellik daha
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
