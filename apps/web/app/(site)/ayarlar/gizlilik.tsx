'use client';

import { KVKK_KIND_KEYS, KVKK_KINDS, type KvkkKind } from '@rengarenk/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CerezTercihleri } from '../../../components/cerez-tercihleri';
import { cx } from '../../../lib/cx';
import { API, erisim, istek } from '../../../lib/istemci';
import stil from './gizlilik.module.css';
import { Anahtar } from './iletisim';

const tarih = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(
    new Date(iso),
  );

interface Engel {
  hesap: string;
  ad: string;
  not: string;
}
interface Kopya {
  id: string;
  durum: 'hazirlaniyor' | 'hazir' | 'hata' | 'suresi_doldu';
  istendi: string;
  gecerlilik: string | null;
}
interface Basvuru {
  numara: string;
  tur: string;
  durum: 'acik' | 'yanitlandi';
  sonTarih: string;
  yanit: string | null;
}

/** Engellediklerin (Ayarlar.dc.html › Gizlilik ve güvenlik) */
export function Engellediklerin({ bildir }: { bildir: (m: string | null, h?: string | null) => void }) {
  const [liste, setListe] = useState<Engel[] | null>(null);
  useEffect(() => {
    istek<Engel[]>('/me/blocks')
      .then(setListe)
      .catch(() => setListe([]));
  }, []);
  return (
    <section className={stil.kutu1} aria-labelledby="en">
      <h2 id="en" className={stil.baslik1}>
        Engellediklerin
      </h2>
      <p className={stil.metin1}>Engellediğin kişiler sana mesaj gönderemez ve taleplerini göremez.</p>
      {liste?.map((e) => (
        <div key={e.hesap} className={stil.kutu2}>
          <span>
            <span className={stil.metin2}>{e.ad}</span>
            <span className={stil.metin3}>{e.not}</span>
          </span>
          <button
            type="button"
            className={stil.dugme1}
            onClick={async () => {
              try {
                setListe(await istek<Engel[]>(`/me/blocks/${e.hesap}`, { method: 'DELETE' }));
                bildir(`${e.ad} için engel kaldırıldı.`);
              } catch (x) {
                bildir(null, (x as Error).message);
              }
            }}
          >
            Engeli kaldır
          </button>
        </div>
      ))}
      {liste && !liste.length ? <p className={stil.metin4}>Engellediğin kimse yok.</p> : null}
    </section>
  );
}

/**
 * Kişisel verilerim (Ayarlar.dc.html; Karar 58): "Verilerimi indir" WhatsApp koduyla istenir, 24 saat içinde hazırlanır,
 * bağlantı 7 gün geçerli. KVKK başvurusu (bilgi alma, düzeltme, silme, itiraz) da WhatsApp koduyla yapılır; 30 gün içinde
 * yanıtlanır.
 */
export function KisiselVerilerim({ bildir }: { bildir: (m: string | null, h?: string | null) => void }) {
  const [kopyalar, setKopyalar] = useState<Kopya[]>([]);
  const [basvurular, setBasvurular] = useState<Basvuru[]>([]);
  const [adim, setAdim] = useState<null | 'indir' | 'kvkk'>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [kod, setKod] = useState('');
  const [tur, setTur] = useState<KvkkKind>('bilgi');
  const [metin, setMetin] = useState('');

  const [reklam, setReklam] = useState<boolean | null>(null);
  const yukle = useCallback(async () => {
    const [k, b, r] = await Promise.all([
      istek<Kopya[]>('/me/data-exports'),
      istek<Basvuru[]>('/me/kvkk'),
      istek<{ acik: boolean }>('/me/reklam-olcum'),
    ]);
    setKopyalar(k);
    setBasvurular(b);
    setReklam(r.acik);
  }, []);
  /** Reklam ölçümü onayı (Karar 35, 59): kapatınca bekleyen olaylar gönderilmez, tıklama kimlikleri silinir */
  async function reklamDegistir() {
    try {
      const r = await istek<{ acik: boolean }>('/me/reklam-olcum', {
        method: 'PUT',
        body: { acik: !reklam },
      });
      setReklam(r.acik);
      bildir(r.acik ? 'Reklam ölçümüne izin verdin.' : 'Reklam ölçümü iznini geri aldın.');
    } catch (e) {
      bildir(null, (e as Error).message);
    }
  }
  useEffect(() => {
    yukle().catch(() => undefined);
  }, [yukle]);

  async function kodIste(ne: 'indir' | 'kvkk') {
    try {
      // Hassas işlem onayı (Karar 58): kod hesaptaki numaraya gider (önce WhatsApp)
      const r = await istek<{ challengeId: string; devCode?: string }>('/auth/code', {
        method: 'POST',
        body: {},
      });
      setChallengeId(r.challengeId);
      setAdim(ne);
      setKod(r.devCode ?? '');
      bildir('Telefonuna doğrulama kodu gönderdik.');
    } catch (e) {
      bildir(null, (e as Error).message);
    }
  }
  async function onayla() {
    if (!challengeId) return;
    try {
      if (adim === 'indir') {
        setKopyalar(
          await istek<Kopya[]>('/me/data-exports', { method: 'POST', body: { challengeId, code: kod } }),
        );
        bildir('Verilerinin kopyası hazırlanıyor; hazır olunca bildirim ve e-posta göndereceğiz.');
      } else {
        const r = await istek<{ numara: string; sonTarih: string }>('/me/kvkk', {
          method: 'POST',
          body: { challengeId, code: kod, tur, metin },
        });
        setMetin('');
        bildir(`Başvurun alındı · ${r.numara}. En geç ${tarih(r.sonTarih)} tarihine kadar yanıtlayacağız.`);
        await yukle();
      }
      setAdim(null);
      setChallengeId(null);
      setKod('');
    } catch (e) {
      bildir(null, (e as Error).message);
    }
  }
  async function indir(id: string) {
    try {
      const token = await erisim();
      const r = await fetch(`${API}/me/data-exports/${id}/download`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'İndirilemedi');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rengarenk-verilerim.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      bildir(null, (e as Error).message);
    }
  }

  const son = kopyalar[0];
  const kodAlani = (
    <div className={stil.kutu3}>
      <label className={stil.etiket1}>
        WhatsApp kodu
        <input
          value={kod}
          onChange={(e) => setKod(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          className={stil.girdi1}
        />
      </label>
      <button
        type="button"
        onClick={onayla}
        disabled={kod.length !== 6 || (adim === 'kvkk' && metin.trim().length < 10)}
        className={stil.dugme2}
      >
        Onayla
      </button>
      <button type="button" onClick={() => setAdim(null)} className={stil.dugme3}>
        Vazgeç
      </button>
    </div>
  );

  return (
    <section className={stil.kutu1} aria-labelledby="kv">
      <h2 id="kv" className={stil.baslik2}>
        Kişisel verilerim
      </h2>
      <div className={stil.kutu2}>
        <span className={stil.metin5}>
          <span className={stil.metin2}>Verilerimi indir</span>
          <span className={stil.metin3}>
            Profil, talepler, mesajlar, ödemeler ve rızaların. Doğrulama kodundan sonra 24 saat içinde
            hazırlanır; bağlantı 7 gün geçerli.
          </span>
          {son ? (
            <span className={cx(stil.metin6, son.durum === 'hazir' ? stil.metin7 : stil.metin8)}>
              {son.durum === 'hazir'
                ? `Hazır · ${son.gecerlilik ? tarih(son.gecerlilik) : ''} tarihine kadar indirilebilir`
                : son.durum === 'hazirlaniyor'
                  ? `${tarih(son.istendi)} tarihinde istendi · hazırlanıyor`
                  : son.durum === 'suresi_doldu'
                    ? 'Son kopyanın süresi doldu'
                    : 'Hazırlanamadı; yeniden dene'}
            </span>
          ) : null}
        </span>
        {son?.durum === 'hazir' ? (
          <button type="button" className={stil.dugme1} onClick={() => indir(son.id)}>
            İndir
          </button>
        ) : son?.durum === 'hazirlaniyor' ? null : (
          <button type="button" className={stil.dugme1} onClick={() => kodIste('indir')}>
            Hazırla
          </button>
        )}
        {adim === 'indir' ? kodAlani : null}
      </div>
      <div className={stil.kutu2}>
        <span className={stil.metin5}>
          <span className={stil.metin2}>KVKK başvurusu</span>
          <span className={stil.metin3}>
            Bilgi alma, düzeltme, silme ya da itiraz. En geç 30 gün içinde yanıtlanır (KVKK m.13).
          </span>
        </span>
        {adim !== 'kvkk' ? (
          <button type="button" className={stil.dugme1} onClick={() => setAdim('kvkk')}>
            Başvur
          </button>
        ) : null}
        {adim === 'kvkk' ? (
          <div className={stil.kutu4}>
            <label className={stil.etiket2}>
              Başvuru türü
              <select
                value={tur}
                onChange={(e) => setTur(e.target.value as KvkkKind)}
                className={stil.girdi1}
              >
                {KVKK_KIND_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {KVKK_KINDS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className={stil.etiket3}>
              Talebin
              <textarea
                rows={4}
                value={metin}
                onChange={(e) => setMetin(e.target.value)}
                maxLength={3000}
                className={stil.girdi2}
              />
            </label>
            {challengeId ? (
              kodAlani
            ) : (
              <button
                type="button"
                onClick={() => kodIste('kvkk')}
                disabled={metin.trim().length < 10}
                className={stil.dugme4}
              >
                Doğrulama kodu gönder
              </button>
            )}
          </div>
        ) : null}
      </div>
      {basvurular.map((b) => (
        <div key={b.numara} className={stil.kutu5}>
          <span className={stil.metin5}>
            <span className={stil.metin9}>
              {b.numara} · {b.tur}
            </span>
            <span className={stil.metin10}>
              {b.durum === 'acik' ? `Yanıt en geç ${tarih(b.sonTarih)}` : b.yanit}
            </span>
          </span>
          <span className={cx(stil.metin11, b.durum === 'acik' ? stil.metin8 : stil.metin7)}>
            {b.durum === 'acik' ? 'İnceleniyor' : 'Yanıtlandı'}
          </span>
        </div>
      ))}
      {reklam === null ? null : (
        <div className={stil.kutu2}>
          <span className={stil.metin12}>
            <span className={stil.metin2}>Reklam ölçümü</span>
            <span className={stil.metin3}>
              Talep ve ödeme gibi adımların, reklamlarımızı ölçmek için Meta ve Google'a özet bilgiyle
              bildirilmesi. Mesajların ve talep açıklaman hiçbir zaman gönderilmez.
            </span>
          </span>
          <Anahtar acik={reklam} ad="Reklam ölçümü" onClick={reklamDegistir} />
        </div>
      )}
      <div className={stil.kutu2}>
        <span>
          <span className={stil.metin2}>Aydınlatma metni ve çerez tercihleri</span>
          <span className={stil.metin3}>Hangi verileri neden işlediğimiz ve haklarınız</span>
        </span>
        <span className={stil.metin13}>
          <CerezTercihleri />
          <Link href="/kvkk">Görüntüle</Link>
        </span>
      </div>
    </section>
  );
}

/**
 * Şifre (Karar 18): şifresi olan mevcut şifresiyle değiştirir; Google ya da Apple ile üye olan isterse şifre belirler
 * (sonra e-posta ve şifreyle de girebilir). Bu cihaz dışındaki oturumlar kapanır.
 */
export function SifreBolumu({
  sifreVar,
  google,
  bildir,
}: {
  sifreVar: boolean;
  google: boolean;
  bildir: (m: string | null, h?: string | null) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [mevcut, setMevcut] = useState('');
  const [yeni, setYeni] = useState('');
  const [busy, setBusy] = useState(false);
  const [var_, setVar] = useState(sifreVar);

  async function kaydet() {
    setBusy(true);
    try {
      const r = await istek<{ kapananOturum: number }>('/auth/password', {
        method: 'POST',
        body: var_ ? { mevcut, yeni } : { yeni },
      });
      setVar(true);
      setAcik(false);
      setMevcut('');
      setYeni('');
      bildir(
        r.kapananOturum
          ? `Şifren kaydedildi; diğer ${r.kapananOturum} cihazdaki oturum kapandı.`
          : 'Şifren kaydedildi.',
      );
    } catch (e) {
      bildir(null, (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={stil.kutu1} aria-labelledby="sifre-baslik">
      <div className={stil.kutu6}>
        <span>
          <h2 id="sifre-baslik" className={stil.baslik3}>
            Şifre
          </h2>
          <span className={stil.metin14}>
            {var_
              ? 'E-posta ve şifrenle giriş yapabilirsin.'
              : google
                ? 'Google ile giriş yapıyorsun. İstersen şifre de belirleyebilirsin.'
                : 'Henüz şifre belirlemedin.'}
          </span>
        </span>
        {acik ? null : (
          <button type="button" className={stil.dugme1} onClick={() => setAcik(true)}>
            {var_ ? 'Şifreyi değiştir' : 'Şifre belirle'}
          </button>
        )}
      </div>
      {acik ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void kaydet();
          }}
          className={stil.kutu7}
        >
          {var_ ? (
            <label className={stil.etiket4}>
              Mevcut şifre
              <input
                type="password"
                autoComplete="current-password"
                value={mevcut}
                onChange={(e) => setMevcut(e.target.value)}
                required
                className={stil.girdi1}
              />
            </label>
          ) : null}
          <label className={stil.etiket4}>
            Yeni şifre
            <input
              type="password"
              autoComplete="new-password"
              value={yeni}
              onChange={(e) => setYeni(e.target.value)}
              required
              minLength={8}
              className={stil.girdi1}
            />
          </label>
          <span className={stil.metin15}>
            En az 8 karakter; içinde harf ve rakam olsun. Bu cihaz dışındaki oturumların kapanır.
          </span>
          <span className={stil.metin16}>
            <button type="submit" disabled={busy} className={stil.dugme5}>
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button type="button" className={stil.dugme1} onClick={() => setAcik(false)}>
              Vazgeç
            </button>
          </span>
        </form>
      ) : null}
    </section>
  );
}
