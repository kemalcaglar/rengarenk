'use client';

import { CALL_HOURS_DEFAULT, demandOwnerName, saatYaz } from '@rengarenk/shared';
import { useState } from 'react';
import { cx } from '../../../lib/cx';
import { istek } from '../../../lib/istemci';
import stil from './iletisim.module.css';

export interface IletisimTercihi {
  phoneVisible: boolean;
  whatsappVisible: boolean;
  callFrom: number;
  callTo: number;
}

export function Anahtar({ acik, ad, onClick }: { acik: boolean; ad: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acik}
      aria-label={ad}
      onClick={onClick}
      className={cx(stil.dugme1, acik ? stil.dugme2 : stil.dugme3)}
    >
      <span className={cx(stil.metin1, acik ? stil.metin2 : stil.metin3)} />
    </button>
  );
}

/**
 * Ayarlar › İletişim (Ayarlar.dc.html; Karar 29): Rengarenk mesajları her zaman açık; telefon ve WhatsApp izni,
 * aranabilir saatler. Yeni talepler bu ayarlarla açılır; her talepte ayrıca değişir.
 */
export function Iletisim({
  v,
  kaydet,
}: {
  v: IletisimTercihi;
  kaydet: (yeni: IletisimTercihi, mesaj: string) => void;
}) {
  const degis = (p: Partial<IletisimTercihi>, mesaj: string) => {
    const yeni = { ...v, ...p };
    // WhatsApp telefon numarası açıkken görünür
    if (!yeni.phoneVisible) yeni.whatsappVisible = false;
    kaydet(yeni, mesaj);
  };
  const satirlar: { ad: string; not: string; acik?: boolean; tikla?: () => void }[] = [
    { ad: 'Rengarenk mesajları', not: 'Satıcılar sana her zaman uygulama içinden yazabilir' },
    {
      ad: 'Telefon numaramı göster',
      not: 'Talep sayfasının sağındaki iletişim kutusunda görünür',
      acik: v.phoneVisible,
      tikla: () =>
        degis(
          { phoneVisible: !v.phoneVisible },
          v.phoneVisible ? 'Numaran yeni taleplerde gizli.' : 'Numaran yeni taleplerde görünecek.',
        ),
    },
    {
      ad: 'WhatsApp ile yazılabilsin',
      not: 'Telefon numaran açıkken WhatsApp düğmesi de görünür',
      acik: v.whatsappVisible,
      tikla: () =>
        degis(
          { whatsappVisible: !v.whatsappVisible, ...(!v.whatsappVisible ? { phoneVisible: true } : {}) },
          v.whatsappVisible ? 'WhatsApp düğmesi kapandı.' : 'WhatsApp düğmesi yeni taleplerde görünecek.',
        ),
    },
  ];
  const baslar = Array.from({ length: 24 }, (_, i) => i);
  const biter = Array.from({ length: 24 }, (_, i) => i + 1);
  return (
    <section className={stil.kutu1} aria-labelledby="il">
      <h2 id="il" className={stil.baslik1}>
        İletişim tercihleri
      </h2>
      <p className={stil.metin4}>Yeni talepler bu ayarlarla açılır. Her talepte ayrıca değiştirebilirsin.</p>
      {satirlar.map((s) => (
        <div key={s.ad} className={stil.kutu2}>
          <span>
            <span className={stil.metin5}>{s.ad}</span>
            <span className={stil.metin6}>{s.not}</span>
          </span>
          {s.tikla ? (
            <Anahtar acik={Boolean(s.acik)} ad={s.ad} onClick={s.tikla} />
          ) : (
            <span className={stil.metin7}>Her zaman açık</span>
          )}
        </div>
      ))}
      <div className={stil.kutu3}>
        <span className={stil.metin8}>
          <span className={stil.metin5}>Aranabileceğim saatler</span>
          <span className={stil.metin6}>Bu saatlerin dışında numaran talep sayfasında gizlenir</span>
        </span>
        <select
          aria-label="Başlangıç saati"
          value={v.callFrom}
          onChange={(e) => {
            const bas = Number(e.target.value);
            degis({ callFrom: bas, callTo: Math.max(v.callTo, bas + 1) }, 'Aranabilir saatlerin kaydedildi.');
          }}
          className={stil.girdi1}
        >
          {baslar.map((h) => (
            <option key={h} value={h}>
              {saatYaz(h)}
            </option>
          ))}
        </select>
        <span aria-hidden="true">–</span>
        <select
          aria-label="Bitiş saati"
          value={v.callTo}
          onChange={(e) => {
            const bit = Number(e.target.value);
            degis(
              { callTo: bit, callFrom: Math.min(v.callFrom, bit - 1) },
              'Aranabilir saatlerin kaydedildi.',
            );
          }}
          className={stil.girdi1}
        >
          {biter.map((h) => (
            <option key={h} value={h}>
              {h === 24 ? '24.00' : saatYaz(h)}
            </option>
          ))}
        </select>
      </div>
      {v.callFrom !== CALL_HOURS_DEFAULT.bas || v.callTo !== CALL_HOURS_DEFAULT.bit ? (
        <p className={stil.metin9}>
          Varsayılan aralık {saatYaz(CALL_HOURS_DEFAULT.bas)}–{saatYaz(CALL_HOURS_DEFAULT.bit)}.
        </p>
      ) : null}
    </section>
  );
}

/** Profil › "Talep sayfalarında adın nasıl görünsün?" (Karar 29) */
export function GorunenAd({
  ad,
  soyad,
  secili,
  sec,
}: {
  ad: string;
  soyad: string;
  secili: 'tam' | 'kisa';
  sec: (m: 'tam' | 'kisa') => void;
}) {
  const ornek = (m: 'tam' | 'kisa') => demandOwnerName(ad || 'Ayşe', soyad || 'Yılmaz', m);
  const secenek: ['tam' | 'kisa', string][] = [
    ['tam', 'Adın ve soyadın tam görünür'],
    ['kisa', 'Soyadının yalnızca baş harfi görünür'],
  ];
  return (
    <>
      <span className={stil.metin10}>Talep sayfalarında adın nasıl görünsün?</span>
      <div role="radiogroup" aria-label="Görünen ad" className={stil.kutu4}>
        {secenek.map(([m, not]) => {
          const on = secili === m;
          return (
            // biome-ignore lint/a11y/useSemanticElements: tasarımdaki gibi iki satırlı seçim düğmesi (Ayarlar.dc.html)
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => sec(m)}
              className={cx(stil.dugme4, on ? stil.dugme5 : stil.dugme6)}
            >
              <span className={stil.metin11}>{ornek(m)}</span>
              <span className={stil.metin6}>{not}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/**
 * "Numarayı değiştir" (Yardim.dc.html: yeni numarana WhatsApp’tan gelen kodu gir). Doğrulanınca diğer cihazlardaki oturumlar
 * kapanır; bu cihaz açık kalır.
 */
export function NumaraDegistir({ bitti }: { bitti: (mesaj: string) => void }) {
  const [acik, setAcik] = useState(false);
  const [tel, setTel] = useState('');
  const [kod, setKod] = useState('');
  const [ch, setCh] = useState<string | null>(null);
  const [devKod, setDevKod] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  async function adim(fn: () => Promise<void>) {
    setHata(null);
    setMesgul(true);
    try {
      await fn();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)} className={stil.dugme7}>
        Numarayı değiştir
      </button>
    );
  }
  return (
    <div className={stil.kutu5}>
      {!ch ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            adim(async () => {
              const r = await istek<{ challengeId: string; devCode?: string }>('/me/phone/request', {
                method: 'POST',
                body: { phone: tel },
              });
              setCh(r.challengeId);
              setDevKod(r.devCode ?? null);
            });
          }}
          className={stil.kutu6}
        >
          <label className="sr-only" htmlFor="yeni-tel">
            Yeni cep telefonu
          </label>
          <input
            id="yeni-tel"
            type="tel"
            inputMode="tel"
            required
            placeholder="05XX XXX XX XX"
            value={tel}
            onChange={(e) => setTel(e.target.value)}
            className={stil.girdi2}
          />
          <button type="submit" disabled={mesgul} className={stil.dugme7}>
            Yeni numaraya kod gönder
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            adim(async () => {
              const r = await istek<{ kapananOturum: number }>('/me/phone/verify', {
                method: 'POST',
                body: { challengeId: ch, code: kod },
              });
              setAcik(false);
              setCh(null);
              setTel('');
              setKod('');
              bitti(
                r.kapananOturum
                  ? `Numaran değişti. Diğer ${r.kapananOturum} cihazdaki oturumun kapandı.`
                  : 'Numaran değişti.',
              );
            });
          }}
          className={stil.kutu6}
        >
          <label className="sr-only" htmlFor="yeni-kod">
            WhatsApp kodu
          </label>
          <input
            id="yeni-kod"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            placeholder="6 haneli kod"
            value={kod}
            onChange={(e) => setKod(e.target.value.replace(/\D/g, ''))}
            className={stil.girdi3}
          />
          <button type="submit" disabled={mesgul} className={stil.dugme8}>
            Doğrula
          </button>
          <span className={stil.metin12}>
            Yeni numarana kod gönderdik.{devKod ? ` Geliştirme kodu: ${devKod}` : ''}
          </span>
        </form>
      )}
      <button
        type="button"
        onClick={() => {
          setAcik(false);
          setCh(null);
          setHata(null);
        }}
        className={stil.dugme9}
      >
        Vazgeç
      </button>
      {hata ? (
        <span role="alert" className={stil.metin13}>
          {hata}
        </span>
      ) : null}
    </div>
  );
}
