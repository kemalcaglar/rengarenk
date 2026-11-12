'use client';

import { KVKK_KIND_KEYS, KVKK_KINDS, type KvkkKind } from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { CerezTercihleri } from '../../../components/cerez-tercihleri';
import { API, erisim, istek } from '../../../lib/istemci';
import { Anahtar } from './iletisim';

const kart: CSSProperties = {
  background: 'var(--rr-kart, #FFFFFF)',
  border: '1px solid var(--rr-cizgi, #E3E6EF)',
  borderRadius: 'var(--rr-kart-kose)',
  padding: 20,
};
const satir: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  padding: '12px 0',
  borderTop: '1px solid #EEF0F5',
};
const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: 'var(--rr-kart, #FFFFFF)',
  borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
  padding: '8px 12px',
  fontSize: 13.5,
  fontWeight: 700,
  color: 'var(--rr-murekkep, #1E2333)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 5,
  border: '1px solid #D5DAE5',
  borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
  padding: 11,
  fontSize: 14.5,
  fontFamily: 'inherit',
  background: 'var(--rr-kart, #FFFFFF)',
};
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
    <section style={kart} aria-labelledby="en">
      <h2 id="en" style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>
        Engellediklerin
      </h2>
      <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--rr-soluk, #5A6073)' }}>
        Engellediğin kişiler sana mesaj gönderemez ve taleplerini göremez.
      </p>
      {liste?.map((e) => (
        <div key={e.hesap} style={satir}>
          <span>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{e.ad}</span>
            <span
              style={{ display: 'block', fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)', marginTop: 2 }}
            >
              {e.not}
            </span>
          </span>
          <button
            type="button"
            style={ikincil}
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
      {liste && !liste.length ? (
        <p
          style={{
            margin: 0,
            paddingTop: 10,
            borderTop: '1px solid #EEF0F5',
            fontSize: 14,
            color: 'var(--rr-soluk, #5A6073)',
          }}
        >
          Engellediğin kimse yok.
        </p>
      ) : null}
    </section>
  );
}

/**
 * Kişisel verilerim (Ayarlar.dc.html; Karar 58): "Verilerimi indir" SMS koduyla istenir, 24 saat içinde hazırlanır,
 * bağlantı 7 gün geçerli. KVKK başvurusu (bilgi alma, düzeltme, silme, itiraz) da SMS koduyla yapılır; 30 gün içinde
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
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'flex-end',
        marginTop: 10,
        width: '100%',
      }}
    >
      <label style={{ flex: '0 1 180px', fontSize: 13, fontWeight: 700 }}>
        SMS kodu
        <input
          value={kod}
          onChange={(e) => setKod(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          style={girdi}
        />
      </label>
      <button
        type="button"
        onClick={onayla}
        disabled={kod.length !== 6 || (adim === 'kvkk' && metin.trim().length < 10)}
        style={{
          ...ikincil,
          background: 'var(--rr-mavi, #5B8CFF)',
          color: 'var(--rr-maviYazi, #1E2333)',
          border: 0,
          padding: '11px 16px',
          fontWeight: 800,
        }}
      >
        Onayla
      </button>
      <button type="button" onClick={() => setAdim(null)} style={{ ...ikincil, border: 0 }}>
        Vazgeç
      </button>
    </div>
  );

  return (
    <section style={kart} aria-labelledby="kv">
      <h2 id="kv" style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800 }}>
        Kişisel verilerim
      </h2>
      <div style={satir}>
        <span style={{ flex: '1 1 300px' }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>Verilerimi indir</span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)', marginTop: 2 }}>
            Profil, talepler, mesajlar, ödemeler ve rızaların. Doğrulama kodundan sonra 24 saat içinde
            hazırlanır; bağlantı 7 gün geçerli.
          </span>
          {son ? (
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
                marginTop: 4,
                fontWeight: 700,
                color: son.durum === 'hazir' ? '#11683F' : '#7A5300',
              }}
            >
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
          <button type="button" style={ikincil} onClick={() => indir(son.id)}>
            İndir
          </button>
        ) : son?.durum === 'hazirlaniyor' ? null : (
          <button type="button" style={ikincil} onClick={() => kodIste('indir')}>
            Hazırla
          </button>
        )}
        {adim === 'indir' ? kodAlani : null}
      </div>
      <div style={satir}>
        <span style={{ flex: '1 1 300px' }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>KVKK başvurusu</span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)', marginTop: 2 }}>
            Bilgi alma, düzeltme, silme ya da itiraz. En geç 30 gün içinde yanıtlanır (KVKK m.13).
          </span>
        </span>
        {adim !== 'kvkk' ? (
          <button type="button" style={ikincil} onClick={() => setAdim('kvkk')}>
            Başvur
          </button>
        ) : null}
        {adim === 'kvkk' ? (
          <div style={{ width: '100%', marginTop: 6 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>
              Başvuru türü
              <select value={tur} onChange={(e) => setTur(e.target.value as KvkkKind)} style={girdi}>
                {KVKK_KIND_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {KVKK_KINDS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginTop: 10 }}>
              Talebin
              <textarea
                rows={4}
                value={metin}
                onChange={(e) => setMetin(e.target.value)}
                maxLength={3000}
                style={{ ...girdi, resize: 'vertical' }}
              />
            </label>
            {challengeId ? (
              kodAlani
            ) : (
              <button
                type="button"
                onClick={() => kodIste('kvkk')}
                disabled={metin.trim().length < 10}
                style={{
                  ...ikincil,
                  marginTop: 10,
                  background: 'var(--rr-mavi, #5B8CFF)',
                  color: 'var(--rr-maviYazi, #1E2333)',
                  border: 0,
                  fontWeight: 800,
                }}
              >
                Doğrulama kodu gönder
              </button>
            )}
          </div>
        ) : null}
      </div>
      {basvurular.map((b) => (
        <div key={b.numara} style={{ ...satir, alignItems: 'flex-start' }}>
          <span style={{ flex: '1 1 300px' }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>
              {b.numara} · {b.tur}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
                color: 'var(--rr-soluk, #5A6073)',
                marginTop: 2,
                whiteSpace: 'pre-wrap',
              }}
            >
              {b.durum === 'acik' ? `Yanıt en geç ${tarih(b.sonTarih)}` : b.yanit}
            </span>
          </span>
          <span
            style={{ fontSize: 12.5, fontWeight: 800, color: b.durum === 'acik' ? '#7A5300' : '#11683F' }}
          >
            {b.durum === 'acik' ? 'İnceleniyor' : 'Yanıtlandı'}
          </span>
        </div>
      ))}
      {reklam === null ? null : (
        <div style={satir}>
          <span style={{ flex: '1 1 300px', minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>Reklam ölçümü</span>
            <span
              style={{ display: 'block', fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)', marginTop: 2 }}
            >
              Talep ve ödeme gibi adımların, reklamlarımızı ölçmek için Meta ve Google'a özet bilgiyle
              bildirilmesi. Mesajların ve talep açıklaman hiçbir zaman gönderilmez.
            </span>
          </span>
          <Anahtar acik={reklam} ad="Reklam ölçümü" onClick={reklamDegistir} />
        </div>
      )}
      <div style={satir}>
        <span>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>
            Aydınlatma metni ve çerez tercihleri
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)', marginTop: 2 }}>
            Hangi verileri neden işlediğimiz ve haklarınız
          </span>
        </span>
        <span style={{ display: 'flex', gap: 16, fontSize: 13.5, fontWeight: 700 }}>
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
    <section style={kart} aria-labelledby="sifre-baslik">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
        <span>
          <h2 id="sifre-baslik" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            Şifre
          </h2>
          <span style={{ display: 'block', fontSize: 13, color: 'var(--rr-soluk, #5A6073)', marginTop: 4 }}>
            {var_
              ? 'E-posta ve şifrenle giriş yapabilirsin.'
              : google
                ? 'Google ile giriş yapıyorsun. İstersen şifre de belirleyebilirsin.'
                : 'Henüz şifre belirlemedin.'}
          </span>
        </span>
        {acik ? null : (
          <button type="button" style={ikincil} onClick={() => setAcik(true)}>
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
          style={{ display: 'grid', gap: 10, marginTop: 14, maxWidth: 420 }}
        >
          {var_ ? (
            <label style={{ fontSize: 13.5, fontWeight: 700 }}>
              Mevcut şifre
              <input
                type="password"
                autoComplete="current-password"
                value={mevcut}
                onChange={(e) => setMevcut(e.target.value)}
                required
                style={girdi}
              />
            </label>
          ) : null}
          <label style={{ fontSize: 13.5, fontWeight: 700 }}>
            Yeni şifre
            <input
              type="password"
              autoComplete="new-password"
              value={yeni}
              onChange={(e) => setYeni(e.target.value)}
              required
              minLength={8}
              style={girdi}
            />
          </label>
          <span style={{ fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)' }}>
            En az 8 karakter; içinde harf ve rakam olsun. Bu cihaz dışındaki oturumların kapanır.
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                ...ikincil,
                background: 'var(--rr-mavi, #5B8CFF)',
                color: 'var(--rr-maviYazi, #1E2333)',
                border: 0,
              }}
            >
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button type="button" style={ikincil} onClick={() => setAcik(false)}>
              Vazgeç
            </button>
          </span>
        </form>
      ) : null}
    </section>
  );
}
